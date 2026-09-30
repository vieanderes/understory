import pytest

from kata_target import katas, time_limit

f = katas.is_properly_nested


@pytest.mark.parametrize(
    ("s", "expected"),
    [
        ("", True),
        ("{[()()]}", True),
        ("([)()]", False),
        ("(", False),
        (")", False),
        ("())(", False),
        ("[]{}()", True),
        ("((((", False),
        ("{[]}}", False),
    ],
)
def test_correctness(s, expected):
    assert f(s) is expected


def test_performance_deep_nesting():
    # Deep nesting also breaks a recursive answer: Python's default limit is about 1,000.
    s = "(" * 100_000 + ")" * 100_000
    with time_limit(1.0):
        assert f(s) is True
        assert f(s + "(") is False
