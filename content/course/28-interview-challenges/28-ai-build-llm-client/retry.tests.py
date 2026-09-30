import asyncio

from solution import HttpError, RetryOptions, call_with_retry

TIMEOUT_MS = 30000


def fake_time(timeouts_that_fire=0):
    """Backoff waits return at once and are recorded. The timeout timer fires only as many
    times as the test allows, and otherwise never."""
    waits = []
    fires = [timeouts_that_fire]

    async def sleep(ms):
        if ms != TIMEOUT_MS:
            waits.append(ms)
            return
        if fires[0] == 0:
            await asyncio.Event().wait()  # never set, so it never returns
        fires[0] -= 1

    return waits, sleep


def options(sleep):
    return RetryOptions(timeout_ms=TIMEOUT_MS, retries=3, base_ms=100, sleep=sleep, random=lambda: 0.5)


def flaky(errors):
    """Raises each given error in turn, then answers."""
    prompts = []

    async def call(prompt, signal):
        prompts.append(prompt)
        if len(prompts) <= len(errors):
            raise errors[len(prompts) - 1]
        return "Tuesday"

    return call, prompts


async def too_late():
    """A hung call: it answers only after many turns of the event loop, later than any
    timeout that fires. Code with no timeout gets this stale answer instead of hanging."""
    for _ in range(50):
        await asyncio.sleep(0)
    return "too late"


async def failure(awaitable):
    try:
        await awaitable
    except Exception as error:
        return error
    raise AssertionError("Expected the call to fail, but it answered")


@test("a first answer comes back at once, with no waits")
async def _():
    waits, sleep = fake_time()
    call, prompts = flaky([])
    assert await call_with_retry(call, "Which day is bin day?", options(sleep)) == "Tuesday"
    assert prompts == ["Which day is bin day?"]
    assert waits == []


@test("a 503 and a 429 are retried, with growing, jittered waits")
async def _():
    waits, sleep = fake_time()
    call, prompts = flaky([HttpError(503), HttpError(429)])
    assert await call_with_retry(call, "Which day is bin day?", options(sleep)) == "Tuesday"
    assert len(prompts) == 3
    assert waits == [50, 100]


@test("a 400 fails at once, because asking again gets the same answer")
async def _():
    waits, sleep = fake_time()
    call, prompts = flaky([HttpError(400)])
    error = await failure(call_with_retry(call, "Which day is bin day?", options(sleep)))
    expect(error).to_be_instance_of(HttpError)
    assert error.status == 400
    assert len(prompts) == 1
    assert waits == []


@test("a bug in our own code is not retried")
async def _():
    waits, sleep = fake_time()
    call, prompts = flaky([TypeError("'NoneType' object is not subscriptable")])
    error = await failure(call_with_retry(call, "Which day is bin day?", options(sleep)))
    expect(error).to_be_instance_of(TypeError)
    assert len(prompts) == 1


@test("after the last retry it gives up and raises the last error")
async def _():
    waits, sleep = fake_time()
    call, prompts = flaky([HttpError(500), HttpError(502), HttpError(503), HttpError(504)])
    error = await failure(call_with_retry(call, "Which day is bin day?", options(sleep)))
    expect(error).to_be_instance_of(HttpError)
    assert error.status == 504
    assert len(prompts) == 4
    assert waits == [50, 100, 200]


@test("a hung call times out, is told to stop, and is retried")
async def _():
    waits, sleep = fake_time(1)
    signals = []

    async def call(prompt, signal):
        signals.append(signal)
        # The first attempt hangs. The second answers at once.
        return await too_late() if len(signals) == 1 else "Tuesday"

    assert await call_with_retry(call, "Which day is bin day?", options(sleep)) == "Tuesday"
    assert len(signals) == 2
    assert signals[0].aborted is True
    assert signals[1].aborted is False
    assert waits == [50]


@test("a call that always hangs ends in a TimeoutError")
async def _():
    waits, sleep = fake_time(4)

    async def call(prompt, signal):
        return await too_late()

    error = await failure(call_with_retry(call, "Which day is bin day?", options(sleep)))
    expect(error).to_be_instance_of(TimeoutError)
    assert waits == [50, 100, 200]
