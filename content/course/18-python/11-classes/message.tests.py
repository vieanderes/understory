from solution import Message


@test("tokens defaults to 0")
def _():
    expect(Message("user", "Hi").tokens).to_equal(0)


@test("tokens can be given by name")
def _():
    expect(Message("assistant", "Hello", tokens=5).tokens).to_equal(5)


@test("two messages with the same fields are equal")
def _():
    expect(Message("user", "Hi")).to_equal(Message("user", "Hi"))


@test("prints its fields")
def _():
    expect(repr(Message("user", "Hi"))).to_equal("Message(role='user', content='Hi', tokens=0)")
