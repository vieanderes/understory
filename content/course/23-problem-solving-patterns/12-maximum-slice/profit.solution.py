def max_profit(prices):
    lowest = float("inf")
    best = 0
    for price in prices:
        # Sell today at the best earlier buy, then let today become a buy.
        best = max(best, price - lowest)
        lowest = min(lowest, price)
    return best
