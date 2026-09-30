from solution import dominant


@test("example from the task")
def _():
    expect(dominant([200, 500, 200, 200, 404])).to_be(200)
    expect(dominant([200, 404])).to_be(-1)


@test("an empty list has no majority")
def _():
    expect(dominant([])).to_be(-1)


@test("one response is a majority")
def _():
    expect(dominant([503])).to_be(503)


@test("exactly half is not more than half")
def _():
    expect(dominant([200, 200, 500, 500])).to_be(-1)


@test("the majority can arrive last")
def _():
    expect(dominant([404, 500, 200, 200, 200])).to_be(200)


@test("the last survivor is not always the majority")
def _():
    expect(dominant([4, 4, 1, 2, 3])).to_be(-1)


@test("performance: 100,001 responses")
def _():
    codes = [200 if i % 2 == 0 else 400 + i % 7 for i in range(100_001)]
    expect(dominant(codes)).to_be(200)
    expect(dominant(codes[1:] + [500])).to_be(-1)
