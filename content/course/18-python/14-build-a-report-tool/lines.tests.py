from solution import report


def case(id, category, passed):
    return {"id": id, "category": category, "passed": passed}


@test("counts passes and names the weakest category")
def _():
    results = [case("t1", "refunds", True), case("t2", "refunds", False), case("t3", "billing", True)]
    expect(report(results)).to_equal(["2 of 3 passed", "Weakest: refunds, 1 of 2 passed"])


@test("compares pass rates, not raw counts")
def _():
    results = [
        case("t1", "billing", True),
        case("t2", "billing", True),
        case("t3", "billing", False),
        case("t4", "refunds", False),
    ]
    expect(report(results)[1]).to_equal("Weakest: refunds, 0 of 1 passed")


@test("a tie goes to the category seen first")
def _():
    results = [case("t1", "shipping", False), case("t2", "billing", False)]
    expect(report(results)).to_equal(["0 of 2 passed", "Weakest: shipping, 0 of 1 passed"])


@test("no results says so")
def _():
    expect(report([])).to_equal(["No results"])
