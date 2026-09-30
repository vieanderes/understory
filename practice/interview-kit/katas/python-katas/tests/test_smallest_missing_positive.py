import random

import pytest

from kata_target import katas, time_limit

f = katas.smallest_missing_positive


@pytest.mark.parametrize(
    ("a", "expected"),
    [
        ([1, 3, 6, 4, 1, 2], 5),
        ([1, 2, 3], 4),
        ([-1, -3], 1),
        ([1], 2),
        ([2], 1),
        ([0], 1),
        ([1_000_000], 1),
        ([2, 2, 2, 1, 1, 3, 5], 4),
        ([-1_000_000, 1_000_000], 1),
    ],
)
def test_correctness(a, expected):
    assert f(a) == expected


def test_does_not_rely_on_sorted_input():
    a = list(range(1, 1001))
    random.Random(7).shuffle(a)
    a.remove(500)
    assert f(a) == 500


def test_performance_100k_values():
    a = list(range(1, 100_001))
    random.Random(1).shuffle(a)
    with time_limit(1.0):
        assert f(a) == 100_001
