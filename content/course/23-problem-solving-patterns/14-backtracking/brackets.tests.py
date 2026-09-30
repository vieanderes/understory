from solution import bracket_strings


@test("example from the task")
def _():
    expect(bracket_strings(2)).to_equal(["(())", "()()"])


@test("one pair")
def _():
    expect(bracket_strings(1)).to_equal(["()"])


@test("zero pairs give one empty string")
def _():
    expect(bracket_strings(0)).to_equal([""])


@test("three pairs, in sorted order")
def _():
    expect(bracket_strings(3)).to_equal(["((()))", "(()())", "(())()", "()(())", "()()()"])


@test("no string closes before it opens")
def _():
    for text in bracket_strings(4):
        depth = 0
        for char in text:
            depth += 1 if char == "(" else -1
            assert depth >= 0, text
        assert depth == 0, text


@test("performance: 12 pairs")
def _():
    strings = bracket_strings(12)
    expect(len(strings)).to_be(208_012)
    expect(strings[0]).to_be("(" * 12 + ")" * 12)
    expect(strings[-1]).to_be("()" * 12)
