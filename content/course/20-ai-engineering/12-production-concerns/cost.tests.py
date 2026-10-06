from solution import cost_usd

# Claude Opus 5.5, dollars per million tokens.
PRICE = {"input": 4.00, "output": 20.00, "cache_read": 0.20}


@test("a million input tokens cost the input price")
def _():
    usage = {"input_tokens": 1_000_000, "output_tokens": 0}
    expect(cost_usd(usage, PRICE)).to_be_close_to(4.00)


@test("output tokens use the output price")
def _():
    usage = {"input_tokens": 0, "output_tokens": 1_000_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(20.00)


@test("a typical call adds input and output")
def _():
    usage = {"input_tokens": 2_000, "output_tokens": 400}
    expect(cost_usd(usage, PRICE)).to_be_close_to(0.016)


@test("cache reads use the cache read price")
def _():
    usage = {"input_tokens": 0, "output_tokens": 0, "cache_read_input_tokens": 1_000_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(0.20)


@test("cache writes cost a quarter more than normal input")
def _():
    usage = {"input_tokens": 0, "output_tokens": 0, "cache_creation_input_tokens": 1_000_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(5.00)


@test("usage without cache fields counts them as zero")
def _():
    usage = {"input_tokens": 100_000, "output_tokens": 10_000}
    expect(cost_usd(usage, PRICE)).to_be_close_to(0.60)
