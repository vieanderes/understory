import functools
import time


class RateLimitError(Exception):
    """Stands in for anthropic.RateLimitError: the provider answered 429."""


def retry(func, attempts=3, sleep=time.sleep):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        delay = 1
        for attempt in range(attempts - 1):
            try:
                return func(*args, **kwargs)
            except RateLimitError:
                sleep(delay)
                delay = delay * 2
        # The last attempt runs outside try, so its error reaches the caller.
        return func(*args, **kwargs)

    return wrapper
