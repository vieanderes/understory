import random

import pytest

from kata_target import katas, time_limit

f = katas.max_slice_sum


@pytest.mark.parametrize(
    ("a", "expected"),
    [
        ([3, 2, -6, 4, 0], 5),
        ([5], 5),
        ([-10], -10),
        ([-3, -1, -2], -1),
        ([1, 2, 3], 6),
        ([2, -1, 2], 3),
        ([-2, 1, -3, 4, -1, 2, 1, -5, 4], 6),
        ([0, 0, 0], 0),
    ],
)
def test_correctness(a, expected):
    assert f(a) == expected


def test_large_sums_do_not_overflow():
    # Python ints do not overflow, but in JavaScript this sum passes 2**53 with larger values.
    assert f([1_000_000] * 1000) == 1_000_000_000


def brute_force(a):
    return max(sum(a[i : j + 1]) for i in range(len(a)) for j in range(i, len(a)))


def test_matches_brute_force_on_random_small_inputs():
    rng = random.Random(3)
    for _ in range(200):
        a = [rng.randint(-20, 20) for _ in range(rng.randint(1, 12))]
        assert f(a) == brute_force(a)


def test_performance_one_million():
    rng = random.Random(5)
    a = [rng.randint(-1_000_000, 1_000_000) for _ in range(1_000_000)]
    with time_limit(2.0):
        f(a)
