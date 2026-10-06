CACHE_WRITE = 1.25  # writing to the cache costs a quarter more than normal input


def cost_usd(usage, price):
    per_input = price["input"] / 1_000_000
    per_output = price["output"] / 1_000_000
    # Cache reads have their own price per model, not a fixed share of input.
    per_cache_read = price["cache_read"] / 1_000_000
    # input_tokens counts only the uncached part, so the three input kinds add up.
    return (
        usage["input_tokens"] * per_input
        + usage.get("cache_read_input_tokens", 0) * per_cache_read
        + usage.get("cache_creation_input_tokens", 0) * per_input * CACHE_WRITE
        + usage["output_tokens"] * per_output
    )
