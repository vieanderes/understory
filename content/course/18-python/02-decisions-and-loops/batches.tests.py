from solution import announce_batches


def lines_from(items, size):
    before = len(printed())
    announce_batches(items, size)
    return printed()[before:]


@test("250 prompts in batches of 100 need 3 batches")
def _():
    expect(lines_from(250, 100)).to_equal(["Batch 1 of 3", "Batch 2 of 3", "Batch 3 of 3"])


@test("200 prompts fill exactly 2 batches")
def _():
    expect(lines_from(200, 100)).to_equal(["Batch 1 of 2", "Batch 2 of 2"])


@test("fewer prompts than a batch still need one")
def _():
    expect(lines_from(5, 10)).to_equal(["Batch 1 of 1"])


@test("no prompts print nothing")
def _():
    expect(lines_from(0, 100)).to_equal([])
