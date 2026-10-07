MIN_QUALITY = {"low": 0.85, "high": 0.95}


def route_request(request, models, budget_left):
    if request["risk"] not in MIN_QUALITY:
        raise ValueError(f"unknown risk: {request['risk']}")
    bar = MIN_QUALITY[request["risk"]]
    eligible = [
        m for m in models
        # No score for this task means not measured, and not measured means not proven.
        if m["quality"].get(request["task"]) is not None
        and m["quality"][request["task"]] >= bar
        and m["cost"] <= budget_left
        and (m["dpa"] or not request["personal_data"])
    ]
    if not eligible:
        return "human" if request["risk"] == "high" else "defer"
    best = min(eligible, key=lambda m: (m["cost"], -m["quality"][request["task"]]))
    return best["name"]
