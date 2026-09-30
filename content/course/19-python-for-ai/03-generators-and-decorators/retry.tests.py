from solution import RateLimitError, retry


def flaky(failures):
    """A fake model call that is rate limited `failures` times, then answers."""
    calls = []

    def summarise(text, style="short"):
        calls.append(text)
        if len(calls) <= failures:
            raise RateLimitError("429 Too Many Requests")
        return f"{style} summary of {text}"

    return summarise, calls


@test("a call that works needs no retry and no wait")
def _():
    summarise, calls = flaky(0)
    waits = []
    assert retry(summarise, sleep=waits.append)("minutes") == "short summary of minutes"
    assert calls == ["minutes"]
    assert waits == []


@test("two 429s, then success, with waits of 1 and 2 seconds")
def _():
    summarise, calls = flaky(2)
    waits = []
    result = retry(summarise, sleep=waits.append)("report", style="long")
    assert result == "long summary of report"
    assert len(calls) == 3
    assert waits == [1, 2]


@test("gives up after the last attempt and raises the error")
def _():
    summarise, calls = flaky(10)
    waits = []
    wrapped = retry(summarise, attempts=4, sleep=waits.append)
    expect(lambda: wrapped("notes")).to_raise(RateLimitError)
    assert len(calls) == 4
    assert waits == [1, 2, 4]


@test("other errors are not retried")
def _():
    waits = []

    def broken(text):
        raise ValueError("bad request")

    expect(lambda: retry(broken, sleep=waits.append)("notes")).to_raise(ValueError)
    assert waits == []


@test("the wrapper keeps the function's name")
def _():
    summarise, calls = flaky(0)
    assert retry(summarise).__name__ == "summarise"
