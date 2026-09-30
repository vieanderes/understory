from solution import is_palindrome


@test("example from the task")
def _():
    assert is_palindrome("No 'x' in Nixon") is True


@test("a phrase with spaces and mixed case")
def _():
    assert is_palindrome("Never odd or even") is True


@test("not a palindrome")
def _():
    assert is_palindrome("Never odd or eve") is False


@test("an empty string reads the same both ways")
def _():
    assert is_palindrome("") is True


@test("only punctuation")
def _():
    assert is_palindrome("?! ,") is True


@test("digits count too")
def _():
    assert is_palindrome("12:21") is True
    assert is_palindrome("1a2") is False


@test("performance: 600,000 characters")
def _():
    half = "Ab, c" * 60_000
    assert is_palindrome(half + half[::-1]) is True
    assert is_palindrome(half + "x" + half[::-1][1:]) is False
