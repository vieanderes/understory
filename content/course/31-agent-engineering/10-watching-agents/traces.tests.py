from solution import find_costly_run

PRICES = {"input": 2.0, "output": 10.0}  # per million tokens


def model(run, tenant, inp, out, stop="tool_use"):
    return {"run": run, "tenant": tenant, "kind": "model",
            "input_tokens": inp, "output_tokens": out, "stop_reason": stop}


def tool(run, tenant, name, args, error=False):
    return {"run": run, "tenant": tenant, "kind": "tool", "tool": name, "args": args, "error": error}


def healthy(run, tenant):
    return [model(run, tenant, 5000, 300), tool(run, tenant, "get_timetable", {"year": 9}),
            model(run, tenant, 6000, 200, "end_turn")]


def looping(run, tenant, turns):
    spans = []
    for _ in range(turns):
        spans.append(model(run, tenant, 40_000, 500))
        spans.append(tool(run, tenant, "find_room", {"period": 3, "day": "Fri"}))
    return spans


@test("finds the costliest run and costs it from model spans")
def _():
    spans = healthy("r1", "oakfield") + looping("r2", "elm-park", 4) + healthy("r3", "oakfield")
    got = find_costly_run(spans, PRICES)
    assert got["run"] == "r2"
    assert got["tenant"] == "elm-park"
    assert got["cost"] == 0.34


@test("names a repeated identical tool call a loop, whatever the key order")
def _():
    spans = [model("r1", "t", 1000, 10),
             tool("r1", "t", "find_room", {"period": 3, "day": "Fri"}),
             model("r1", "t", 1000, 10),
             tool("r1", "t", "find_room", {"day": "Fri", "period": 3}),
             model("r1", "t", 1000, 10),
             tool("r1", "t", "find_room", {"period": 3, "day": "Fri"}),
             model("r1", "t", 1000, 10, "end_turn")]
    assert find_costly_run(spans, PRICES)["failure"] == "loop"


@test("a run that ends at max_tokens is truncation, and a refusal is a refusal")
def _():
    cut = healthy("r1", "t")[:-1] + [model("r1", "t", 9000, 4000, "max_tokens")]
    assert find_costly_run(cut, PRICES)["failure"] == "truncation"
    refused = [model("r2", "t", 3000, 50, "refusal")]
    assert find_costly_run(refused, PRICES)["failure"] == "refusal"


@test("a tool error with a normal ending is tool misuse, and a clean run is none")
def _():
    bad = [model("r1", "t", 2000, 100), tool("r1", "t", "book_room", {"room": "Z9"}, error=True),
           model("r1", "t", 2500, 100, "end_turn")]
    assert find_costly_run(bad, PRICES)["failure"] == "tool_misuse"
    assert find_costly_run(healthy("r2", "t"), PRICES)["failure"] == "none"


@test("adds up cost per tenant across runs")
def _():
    spans = healthy("r1", "oakfield") + healthy("r2", "oakfield") + healthy("r3", "elm-park")
    got = find_costly_run(spans, PRICES)
    assert got["by_tenant"] == {"oakfield": 0.054, "elm-park": 0.027}


@test("no model spans gives None")
def _():
    assert find_costly_run([], PRICES) is None
    assert find_costly_run([tool("r1", "t", "get_timetable", {})], PRICES) is None
