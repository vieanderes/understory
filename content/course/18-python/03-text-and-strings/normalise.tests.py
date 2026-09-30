from solution import normalise


@test("lower-cases, trims and keeps one space between words")
def _():
    expect(normalise("  What IS   a token?\n")).to_equal("what is a token?")


@test("two spellings of one question come out the same")
def _():
    expect(normalise("Hello  world")).to_equal(normalise(" hello WORLD "))


@test("a tab between words becomes one space")
def _():
    expect(normalise("rate\tlimit")).to_equal("rate limit")


@test("empty text stays empty")
def _():
    expect(normalise("")).to_equal("")
