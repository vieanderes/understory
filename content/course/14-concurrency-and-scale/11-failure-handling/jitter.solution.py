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
    for attempt in range(1, options.attempts + 1):
        try:
            return await fn()
        except Exception as error:
            if isinstance(error, HttpError):
                retryable = error.status == 429 or error.status >= 500
            else:
                retryable = isinstance(error, TimeoutError)
            if not retryable or attempt >= options.attempts:
                raise
            # Full jitter: anywhere from 0 up to the backoff, so clients spread out.
            await options.sleep(options.random() * options.base_ms * 2 ** (attempt - 1))
