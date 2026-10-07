from solution import CircuitBreaker


def failing(breaker, times, now=0):
    for _ in range(times):
        breaker.record(False, now)


@test("a new breaker lets calls through")
def _():
    assert CircuitBreaker(3, 30).allow(0) is True


@test("it opens after `threshold` failures in a row")
def _():
    breaker = CircuitBreaker(3, 30)
    failing(breaker, 2)
    assert breaker.allow(1) is True
    failing(breaker, 1)
    assert breaker.allow(1) is False


@test("a success resets the count")
def _():
    breaker = CircuitBreaker(3, 30)
    failing(breaker, 2)
    breaker.record(True, 0)
    failing(breaker, 2)
    assert breaker.allow(1) is True


@test("after the cool-down a trial call goes through")
def _():
    breaker = CircuitBreaker(3, 30)
    failing(breaker, 3, now=100)
    assert breaker.allow(129) is False
    assert breaker.allow(130) is True


@test("a successful trial closes it")
def _():
    breaker = CircuitBreaker(3, 30)
    failing(breaker, 3, now=100)
    breaker.record(True, 130)
    assert breaker.allow(131) is True


@test("a failed trial opens it again from that moment")
def _():
    breaker = CircuitBreaker(3, 30)
    failing(breaker, 3, now=100)
    breaker.record(False, 130)
    assert breaker.allow(140) is False
    assert breaker.allow(160) is True
