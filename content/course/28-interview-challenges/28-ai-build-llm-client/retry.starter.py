from collections.abc import Awaitable, Callable
from dataclasses import dataclass


class HttpError(Exception):
    """What a failed call raises when the API answered with an error status."""

    def __init__(self, status: int):
        super().__init__(f"HTTP {status}")
        self.status = status


# A timeout raises Python's own TimeoutError.


@dataclass
class Signal:
    """Tells a call to stop. The call checks `aborted`."""

    aborted: bool = False


ModelCall = Callable[[str, Signal], Awaitable[str]]


@dataclass
class RetryOptions:
    timeout_ms: float
    retries: int  # extra attempts after the first
    base_ms: float
    sleep: Callable[[float], Awaitable[None]]
    random: Callable[[], float]  # from 0 up to 1, like random.random


async def call_with_retry(call: ModelCall, prompt: str, options: RetryOptions) -> str:
    # One attempt, no deadline, no retries. Make it survive a hang, a 429 and a 503.
    return await call(prompt, Signal())
