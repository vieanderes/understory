from solution import plan_actions

POLICY = {
    "search_orders": "auto",
    "read_order": "auto",
    "refund": "confirm",
    "send_email": "confirm",
    "delete_account": "never",
}


def call(call_id, name):
    return {"type": "tool_use", "id": call_id, "name": name, "input": {}}


@test("read-only tools run straight away")
def _():
    plan = plan_actions([call("t1", "read_order")], POLICY)
    assert plan == {"run": ["t1"], "confirm": [], "refuse": []}


@test("risky tools wait for a person")
def _():
    plan = plan_actions([call("t1", "refund"), call("t2", "send_email")], POLICY)
    assert plan["confirm"] == ["t1", "t2"]
    assert plan["run"] == []


@test("forbidden tools are refused")
def _():
    plan = plan_actions([call("t1", "delete_account")], POLICY)
    assert plan["refuse"] == ["t1"]


@test("a tool the policy doesn't name is refused")
def _():
    plan = plan_actions([call("t1", "export_all_customers")], POLICY)
    assert plan["refuse"] == ["t1"]


@test("a mixed reply is split, keeping each group in order")
def _():
    calls = [call("t1", "search_orders"), call("t2", "refund"), call("t3", "wire_money"),
             call("t4", "read_order")]
    assert plan_actions(calls, POLICY) == {"run": ["t1", "t4"], "confirm": ["t2"], "refuse": ["t3"]}


@test("no calls gives three empty lists")
def _():
    assert plan_actions([], POLICY) == {"run": [], "confirm": [], "refuse": []}
