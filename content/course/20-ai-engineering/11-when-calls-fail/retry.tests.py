from solution import (
    APITimeoutError,
    BadRequestError,
    OverloadedError,
    RateLimitError,
    call_with_retries,
)


def failing(*errors, answer="ok"):
    """A fake model call: raises each error in turn, then answers."""
    calls = []

    def call():
        calls.append(1)
        if len(calls) <= len(errors):
            raise errors[len(calls) - 1]
        return answer

    return call, calls


@test("a call that works is made once, with no waiting")
def _():
    call, calls = failing()
    waits = []
    assert call_with_retries(call, waits.append) == "ok"
    assert len(calls) == 1 and waits == []


@test("retries rate limits, overloads and timeouts, waiting 1, 2, 4 seconds")
def _():
    call, calls = failing(RateLimitError(), OverloadedError(), APITimeoutError())
    waits = []
    assert call_with_retries(call, waits.append) == "ok"
    assert waits == [1, 2, 4]


@test("waits as long as the server's retry_after says")
def _():
    call, calls = failing(RateLimitError(retry_after=7))
    waits = []
    call_with_retries(call, waits.append)
    assert waits == [7]


@test("never retries a bad request")
def _():
    call, calls = failing(BadRequestError("prompt is too long"))
    waits = []
    expect(lambda: call_with_retries(call, waits.append)).to_raise(BadRequestError)
    assert len(calls) == 1 and waits == []


@test("after the last attempt, the error reaches the caller")
def _():
    call, calls = failing(*[OverloadedError()] * 10)
    waits = []
    expect(lambda: call_with_retries(call, waits.append, attempts=3)).to_raise(OverloadedError)
    assert len(calls) == 3
    assert waits == [1, 2]
