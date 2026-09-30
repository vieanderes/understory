class RateLimitError(Exception):
    """429: too many requests. retry_after is the wait the server asked for, or None."""

    def __init__(self, retry_after=None):
        super().__init__("429 Too Many Requests")
        self.retry_after = retry_after


class OverloadedError(Exception):
    """529: the provider is busy."""


class APITimeoutError(Exception):
    """No reply before the timeout."""


class BadRequestError(Exception):
    """400: the request itself is wrong. Sending it again won't help."""


def call_with_retries(call, sleep, attempts=4):
    # Your code here
    return call()
