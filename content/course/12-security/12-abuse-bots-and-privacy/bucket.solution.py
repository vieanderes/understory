from dataclasses import dataclass


@dataclass(frozen=True)
class Bucket:
    tokens: float
    last: float  # milliseconds


@dataclass(frozen=True)
class Result:
    ok: bool
    bucket: Bucket


def take(bucket: Bucket, now: float, capacity: float, refill_per_sec: float) -> Result:
    elapsed = (now - bucket.last) / 1000
    filled = min(capacity, bucket.tokens + elapsed * refill_per_sec)
    if filled >= 1:
        return Result(True, Bucket(filled - 1, now))
    return Result(False, Bucket(filled, now))
