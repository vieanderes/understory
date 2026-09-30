from solution import detect_loop

A = 'search("flights LIS")'
B = "open(1)"
C = "book(1)"


@test("the same call three times in a row is a loop")
def _():
    assert detect_loop([C, A, A, A], 3) is True


@test("two calls taking turns three times is a loop")
def _():
    assert detect_loop([A, B, A, B, A, B], 3) is True


@test("taking turns only twice isn't yet a loop at 3 repeats")
def _():
    assert detect_loop([A, B, A, B], 3) is False


@test("progress through different calls isn't a loop")
def _():
    assert detect_loop([A, B, C, A, B], 2) is False


@test("a short history is never a loop")
def _():
    assert detect_loop([A], 2) is False
    assert detect_loop([], 2) is False


@test("repeats below 2 raises ValueError")
def _():
    expect(lambda: detect_loop([A, A], 1)).to_raise(ValueError)
