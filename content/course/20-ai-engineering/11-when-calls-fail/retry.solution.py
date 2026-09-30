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


RETRYABLE = (RateLimitError, OverloadedError, APITimeoutError)


def call_with_retries(call, sleep, attempts=4):
    for attempt in range(attempts):
        try:
            return call()
        except RETRYABLE as error:
            if attempt == attempts - 1:
                raise
            # The server knows best how long to wait, when it says.
            wait = getattr(error, "retry_after", None)
            sleep(wait if wait is not None else 2 ** attempt)
