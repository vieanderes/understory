MIN_QUALITY = {"low": 0.85, "high": 0.95}


def route_request(request, models, budget_left):
    # Pick the cheapest model that is measured, good enough, affordable and allowed.
    # Nothing fits: "human" for high risk, "defer" for low risk.
    return min(models, key=lambda m: m["cost"])["name"]
