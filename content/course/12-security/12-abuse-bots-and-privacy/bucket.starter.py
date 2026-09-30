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
    # Replace this. It lets every request through, so the bucket never limits anything.
    return Result(True, Bucket(capacity, now))
