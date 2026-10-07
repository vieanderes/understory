import json


def cost_of(span, prices):
    return (span["input_tokens"] * prices["input"] + span["output_tokens"] * prices["output"]) / 1_000_000


def classify(spans):
    calls = [
        (s["tool"], json.dumps(s["args"], sort_keys=True))  # same call, any key order
        for s in spans if s["kind"] == "tool"
    ]
    if any(calls.count(call) >= 3 for call in calls):
        return "loop"
    last_model = [s for s in spans if s["kind"] == "model"][-1]
    if last_model["stop_reason"] == "max_tokens":
        return "truncation"
    if last_model["stop_reason"] == "refusal":
        return "refusal"
    if any(s.get("error") for s in spans if s["kind"] == "tool"):
        return "tool_misuse"
    return "none"


def find_costly_run(spans, prices):
    runs, tenants, cost = {}, {}, {}
    for span in spans:
        runs.setdefault(span["run"], []).append(span)
        tenants[span["run"]] = span["tenant"]
        if span["kind"] == "model":
            cost[span["run"]] = cost.get(span["run"], 0) + cost_of(span, prices)
    if not cost:
        return None

    by_tenant = {}
    for run, amount in cost.items():
        by_tenant[tenants[run]] = by_tenant.get(tenants[run], 0) + amount

    worst = max(cost, key=cost.get)  # max keeps the first of equal costs
    return {
        "run": worst,
        "tenant": tenants[worst],
        "cost": round(cost[worst], 4),
        "failure": classify(runs[worst]),
        "by_tenant": {t: round(c, 4) for t, c in by_tenant.items()},
    }
