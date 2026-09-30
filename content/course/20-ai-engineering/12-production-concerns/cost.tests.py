from solution import cost_usd

PRICE = {"input": 5.00, "output": 25.00}   # dollars per million tokens


@test("a million input tokens cost the input price")
def _():
    usage = {"input_tokens": 1_000_000, "output_tokens": 0}
    expect(cost_usd(usage, PRICE)).to_be_close_to(5.00)


@test("output tokens use the output price")
def _():
    usage = {"input_tokens": 0, "output_tokens": 1_000_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(25.00)


@test("a typical call adds input and output")
def _():
    usage = {"input_tokens": 2_000, "output_tokens": 400}
    expect(cost_usd(usage, PRICE)).to_be_close_to(0.02)


@test("cache reads cost a tenth of normal input")
def _():
    usage = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 1_000_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(0.50)


@test("cache writes cost a quarter more than normal input")
def _():
    usage = {"input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 1_000_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(6.25)


@test("usage without cache fields counts them as zero")
def _():
    usage = {"input_tokens": 100_000, "output_tokens": 10_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(0.75)
