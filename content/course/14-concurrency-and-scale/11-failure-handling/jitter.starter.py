from collections.abc import Awaitable, Callable
from dataclasses import dataclass


class HttpError(Exception):
    """What a failed call raises when the service answered with an error status."""

    def __init__(self, status: int):
        super().__init__(f"HTTP {status}")
        self.status = status


@dataclass
class RetryOptions:
    attempts: int
    base_ms: float
    random: Callable[[], float]  # from 0 up to 1, like random.random
    sleep: Callable[[float], Awaitable[None]]


async def retry_with_jitter(fn, options: RetryOptions):
    # Tries once. Retry what may pass next time, with a random wait that grows.
    return await fn()
