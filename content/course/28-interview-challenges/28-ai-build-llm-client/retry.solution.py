import asyncio
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


def is_retryable(error: Exception) -> bool:
    if isinstance(error, HttpError):
        return error.status == 429 or error.status >= 500
    return isinstance(error, TimeoutError)


# One attempt races the call against a timer. If the timer wins, the signal tells the
# call to stop, so a hung request doesn't keep running after we've given up on it.
async def attempt(call: ModelCall, prompt: str, options: RetryOptions) -> str:
    signal = Signal()
    work = asyncio.ensure_future(call(prompt, signal))
    timer = asyncio.ensure_future(options.sleep(options.timeout_ms))
    done, _ = await asyncio.wait({work, timer}, return_when=asyncio.FIRST_COMPLETED)
    if work in done:
        timer.cancel()
        return work.result()
    signal.aborted = True
    work.cancel()
    raise TimeoutError(f"No answer within {options.timeout_ms} ms")


async def call_with_retry(call: ModelCall, prompt: str, options: RetryOptions) -> str:
    tries = 0
    while True:
        try:
            return await attempt(call, prompt, options)
        except Exception as error:
            if tries >= options.retries or not is_retryable(error):
                raise
        # Full jitter: anywhere from 0 up to the backoff, so clients spread out.
        await options.sleep(options.random() * options.base_ms * 2**tries)
        tries += 1
