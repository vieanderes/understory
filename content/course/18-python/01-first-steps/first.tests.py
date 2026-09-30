@test("the first line says Hello, Python")
def _():
    expect(printed()[0:1]).to_equal(["Hello, Python"])


@test("the second line is the answer to 7 * 6")
def _():
    expect(printed()[1:2]).to_equal(["42"])


@test("it prints two lines")
def _():
    expect(printed()).to_have_length(2)
