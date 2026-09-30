from solution import is_balanced


@test("example from the task")
def _():
    assert is_balanced('{"ids": [1, (2)]}') is True
    assert is_balanced("(]") is False


@test("an empty string is balanced")
def _():
    assert is_balanced("") is True


@test("text with no brackets is balanced")
def _():
    assert is_balanced("port = 8080") is True


@test("an opener that never closes")
def _():
    assert is_balanced("(()") is False


@test("a closer with nothing open")
def _():
    assert is_balanced("())") is False
    assert is_balanced(")(") is False


@test("pairs that cross")
def _():
    assert is_balanced("([)]") is False


@test("performance: 100,000 nested pairs")
def _():
    deep = "([{" * 33_334 + "}])" * 33_334
    assert is_balanced(deep) is True
    assert is_balanced(deep[:-1]) is False
