def two_sum(prices, target):
    seen = {}
    for i, price in enumerate(prices):
        need = target - price
        if need in seen:
            return [seen[need], i]
        # Stored after the check, so a price can't pair with itself.
        seen[price] = i
    return None
