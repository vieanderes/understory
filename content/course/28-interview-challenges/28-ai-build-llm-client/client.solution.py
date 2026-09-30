import asyncio
from collections.abc import Awaitable, Callable

# A model call that already has its timeout and retries.
Complete = Callable[[str], Awaitable[str]]


class Client:
    def __init__(self, call: Complete):
        self._call = call
        # The task, not the answer: a caller who asks while the first call still runs
        # awaits the same task. A coroutine can be awaited only once, a task any number.
        self._cache: dict[str, asyncio.Task[str]] = {}

    async def complete(self, prompt: str) -> str:
        task = self._cache.get(prompt)
        if task is None:
            task = asyncio.ensure_future(self._call(prompt))
            self._cache[prompt] = task
        try:
            return await task
        except Exception:
            # Forget a failure, or every later caller gets the same error for ever.
            if self._cache.get(prompt) is task:
                del self._cache[prompt]
            raise

    async def complete_many(self, prompts: list[str], limit: int) -> list[str]:
        gate = asyncio.Semaphore(limit)

        async def one(prompt: str) -> str:
            async with gate:
                return await self.complete(prompt)

        # gather returns results in the order it was given, whatever order they finish in.
        return list(await asyncio.gather(*(one(p) for p in prompts)))
