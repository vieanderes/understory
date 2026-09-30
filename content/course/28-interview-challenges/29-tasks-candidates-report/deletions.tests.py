from solution import min_deletions


@test("the example from the task")
def _():
    expect(min_deletions("BAAABAB")).to_be(2)


@test("already in order needs no deletions")
def _():
    expect(min_deletions("AABB")).to_be(0)
    expect(min_deletions("")).to_be(0)


@test("one letter of each kind out of order")
def _():
    expect(min_deletions("BA")).to_be(1)


@test("it is cheaper to delete the Bs when they are fewer")
def _():
    expect(min_deletions("BBBAAAA")).to_be(3)


@test("it is cheaper to delete the As when they are fewer")
def _():
    expect(min_deletions("AAAABBBBA")).to_be(1)
    expect(min_deletions("BBAA")).to_be(2)


@test("alternating letters")
def _():
    expect(min_deletions("ABABAB")).to_be(2)


@test("performance: 100,000 letters")
def _():
    expect(min_deletions("B" * 50_000 + "A" * 50_000)).to_be(50_000)
    expect(min_deletions("AB" * 50_000)).to_be(49_999)
