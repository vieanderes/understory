from solution import passing_cars


@test("the example from the task")
def _():
    expect(passing_cars([0, 1, 0, 1, 1])).to_be(5)


@test("a west car before every east car passes nobody")
def _():
    expect(passing_cars([1, 1, 0])).to_be(0)


@test("all one direction gives no pairs")
def _():
    expect(passing_cars([0, 0, 0])).to_be(0)
    expect(passing_cars([1])).to_be(0)


@test("exactly 1,000,000,000 pairs is still returned")
def _():
    cars = [0] * 50_000 + [1] * 20_000
    expect(passing_cars(cars)).to_be(1_000_000_000)


@test("more than 1,000,000,000 pairs gives -1")
def _():
    cars = [0] * 50_000 + [1] * 20_001
    expect(passing_cars(cars)).to_be(-1)


@test("performance: 100,000 alternating cars")
def _():
    cars = [i % 2 for i in range(100_000)]
    expect(passing_cars(cars)).to_be(-1)
    expect(passing_cars(cars[:60_000])).to_be(450_015_000)
