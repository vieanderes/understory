import asyncio
from collections.abc import Awaitable, Callable

# A model call that already has its timeout and retries.
Complete = Callable[[str], Awaitable[str]]


class Client:
    def __init__(self, call: Complete):
        self._call = call

    async def complete(self, prompt: str) -> str:
        # Every call reaches the model, even one asked a moment ago.
        return await self._call(prompt)

    async def complete_many(self, prompts: list[str], limit: int) -> list[str]:
        # All at once: a thousand prompts means a thousand calls in flight.
        return list(await asyncio.gather(*(self.complete(p) for p in prompts)))
