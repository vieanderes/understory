from solution import clean_tags


@test("trims, lower-cases and drops empty tags")
def _():
    expect(clean_tags(" Python, AI ,, ")).to_equal(["python", "ai"])


@test("one tag gives a list of one")
def _():
    expect(clean_tags("Refunds")).to_equal(["refunds"])


@test("keeps the order the tags were typed in")
def _():
    expect(clean_tags("b,a,c")).to_equal(["b", "a", "c"])


@test("only commas and spaces give an empty list")
def _():
    expect(clean_tags("  ,  ")).to_equal([])
