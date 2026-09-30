import functools
import time


class RateLimitError(Exception):
    """Stands in for anthropic.RateLimitError: the provider answered 429."""


def retry(func, attempts=3, sleep=time.sleep):
    # Your code here
    return func
