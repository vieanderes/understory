from solution import main, total


@test("importing the file prints nothing")
def _():
    expect(printed()).to_equal([])


@test("main still prints the total")
def _():
    main()
    expect(printed()).to_equal(["Total: 12"])


@test("total still adds the prices")
def _():
    expect(total([1.5, 2.5])).to_equal(4.0)
