from solution import order_line


@test("shows the quantity, the item and the total to two decimals")
def _():
    expect(order_line("Tea", 4, 2.5)).to_equal("4 x Tea: 10.00")


@test("rounds the total to two decimals")
def _():
    expect(order_line("Pen", 3, 1.1)).to_equal("3 x Pen: 3.30")


@test("a total of 50 or more adds free delivery")
def _():
    expect(order_line("Coffee beans", 2, 30)).to_equal("2 x Coffee beans: 60.00, free delivery")
    expect(order_line("Mug", 5, 10)).to_equal("5 x Mug: 50.00, free delivery")
