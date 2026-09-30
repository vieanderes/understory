from solution import HttpError, RetryOptions, retry_with_jitter


def make_service(failures):
    """A fake service that raises each error in `failures`, then answers 'ok'."""
    calls = {"count": 0}

    async def fn():
        calls["count"] += 1
        if calls["count"] <= len(failures):
            raise failures[calls["count"] - 1]
        return "ok"

    return fn, calls


def make_options(attempts, random_value=0.5):
    waits = []

    async def sleep(ms):
        waits.append(ms)

    return RetryOptions(attempts=attempts, base_ms=100, random=lambda: random_value, sleep=sleep), waits


async def caught(awaitable):
    try:
        await awaitable
    except Exception as error:
        return error
    return None


@test("a first success returns at once, with no wait")
async def _():
    fn, calls = make_service([])
    options, waits = make_options(3)
    assert await retry_with_jitter(fn, options) == "ok"
    assert calls["count"] == 1
    assert waits == []


@test("a 503 is retried after a random wait")
async def _():
    fn, calls = make_service([HttpError(503)])
    options, waits = make_options(3, 0.25)
    assert await retry_with_jitter(fn, options) == "ok"
    assert calls["count"] == 2
    assert waits == [25]


@test("429 and timeouts are retried, and the waits double")
async def _():
    fn, _calls = make_service([HttpError(429), TimeoutError("The operation timed out"), HttpError(500)])
    options, waits = make_options(4)
    assert await retry_with_jitter(fn, options) == "ok"
    assert waits == [50, 100, 200]


@test("after the last attempt, the last error is raised")
async def _():
    last = HttpError(502)
    fn, calls = make_service([HttpError(503), HttpError(503), last])
    options, _waits = make_options(3)
    assert await caught(retry_with_jitter(fn, options)) is last
    assert calls["count"] == 3


@test("a 400 is raised at once, never retried")
async def _():
    bad = HttpError(400)
    fn, calls = make_service([bad])
    options, waits = make_options(3)
    assert await caught(retry_with_jitter(fn, options)) is bad
    assert calls["count"] == 1
    assert waits == []


@test("a bug in your own code is not retried")
async def _():
    fn, calls = make_service([TypeError("'NoneType' object is not iterable")])
    options, _waits = make_options(3)
    expect(await caught(retry_with_jitter(fn, options))).to_be_instance_of(TypeError)
    assert calls["count"] == 1
