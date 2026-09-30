from solution import Bucket, take


@test("a request with a token goes through")
def _():
    r = take(Bucket(tokens=3, last=0), 0, 5, 1)
    assert r.ok is True
    assert r.bucket.tokens == 2


@test("an empty bucket refuses")
def _():
    r = take(Bucket(tokens=0, last=0), 0, 5, 1)
    assert r.ok is False


@test("tokens refill over time, one per second")
def _():
    r = take(Bucket(tokens=0, last=0), 1000, 5, 1)
    assert r.ok is True
    assert r.bucket.tokens == 0


@test("refill never passes the capacity")
def _():
    r = take(Bucket(tokens=5, last=0), 100_000, 5, 1)
    assert r.bucket.tokens == 4


@test("a burst of six on a bucket of five leaves the sixth refused")
def _():
    bucket = Bucket(tokens=5, last=0)
    results = []
    for _ in range(6):
        r = take(bucket, 0, 5, 1)
        bucket = r.bucket
        results.append(r.ok)
    assert results == [True, True, True, True, True, False]
