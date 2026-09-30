from solution import chunk_by_heading

PAGE = """## Refunds
You can return any item within 30 days.

It takes 5 working days to reach your account.

## Exchanges
Swap an item for another size in store."""


@test("each paragraph carries its title and heading")
def _():
    assert chunk_by_heading("Returns policy", PAGE) == [
        "Returns policy > Refunds: You can return any item within 30 days.",
        "Returns policy > Refunds: It takes 5 working days to reach your account.",
        "Returns policy > Exchanges: Swap an item for another size in store.",
    ]


@test("text before the first heading gets the title only")
def _():
    text = "Read this first.\n\n## Delivery\nOrders ship in 2 days."
    assert chunk_by_heading("Help", text) == [
        "Help: Read this first.",
        "Help > Delivery: Orders ship in 2 days.",
    ]


@test("a paragraph over several lines becomes one chunk")
def _():
    text = "## Opening hours\nWeekdays 9 to 6.\nSaturdays 10 to 4."
    assert chunk_by_heading("Stores", text) == ["Stores > Opening hours: Weekdays 9 to 6. Saturdays 10 to 4."]


@test("a heading with no text under it makes no chunk")
def _():
    text = "## Empty\n\n## Returns\nKeep the receipt."
    assert chunk_by_heading("FAQ", text) == ["FAQ > Returns: Keep the receipt."]


@test("an empty document gives no chunks")
def _():
    assert chunk_by_heading("FAQ", "") == []
