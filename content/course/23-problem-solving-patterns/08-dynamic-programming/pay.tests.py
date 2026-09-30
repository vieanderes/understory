from solution import best_pay


@test("no shifts earn nothing")
def _():
    expect(best_pay([])).to_be(0)


@test("one shift earns its pay")
def _():
    expect(best_pay([40])).to_be(40)


@test("example: never two shifts in a row")
def _():
    expect(best_pay([10, 20, 30, 10])).to_be(40)


@test("skipping two in a row can be best")
def _():
    expect(best_pay([20, 70, 90, 30, 10])).to_be(120)
    expect(best_pay([50, 10, 10, 50])).to_be(100)


@test("shifts that pay nothing are fine")
def _():
    expect(best_pay([0, 0, 0])).to_be(0)


@test("performance: 100,000 shifts")
def _():
    expect(best_pay([1] * 100_000)).to_be(50_000)
