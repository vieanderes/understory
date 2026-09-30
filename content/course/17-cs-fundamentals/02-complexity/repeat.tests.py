from solution import repeat_customers


@test("keeps the emails that came back")
def _():
    expect(repeat_customers(["ana@mail.test", "ben@mail.test"], ["ben@mail.test", "caz@mail.test"])).to_equal(
        ["ben@mail.test"]
    )


@test("keeps today's order")
def _():
    expect(
        repeat_customers(["a@mail.test", "b@mail.test", "c@mail.test"], ["c@mail.test", "a@mail.test"])
    ).to_equal(["c@mail.test", "a@mail.test"])


@test("no one came back")
def _():
    expect(repeat_customers(["a@mail.test"], ["b@mail.test"])).to_equal([])
    expect(repeat_customers([], ["b@mail.test"])).to_equal([])


@test("copes with 20,000 emails a day")
def _():
    yesterday = [f"old{i}@mail.test" for i in range(20_000)]
    today = [f"new{i}@mail.test" for i in range(20_000)]
    today += ["old7@mail.test", "old19999@mail.test"]
    expect(repeat_customers(yesterday, today)).to_equal(["old7@mail.test", "old19999@mail.test"])
