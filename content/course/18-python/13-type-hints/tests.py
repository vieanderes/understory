from typing import get_type_hints

from solution import Order, open_total


@test("adds the totals of open orders only")
def _():
    orders = [
        {"id": 1, "status": "open", "total": 20.0},
        {"id": 2, "status": "closed", "total": 5.0},
        {"id": 3, "status": "open", "total": 7.5},
    ]
    expect(open_total(orders)).to_equal(27.5)


@test("no orders gives 0.0")
def _():
    expect(open_total([])).to_equal(0.0)


@test("orders is hinted as list[Order]")
def _():
    expect(get_type_hints(open_total).get("orders")).to_equal(list[Order])


@test("the return is hinted as float")
def _():
    expect(get_type_hints(open_total).get("return")).to_be(float)
