from solution import run_tool

STOCK = {"blue mug": 4, "red mug": 0}


def check_stock(product):
    if product not in STOCK:
        raise ValueError(f"No product called {product}")
    return STOCK[product]


def delivery_days(postcode, express=False):
    return 1 if express else 3


TOOLS = {"check_stock": check_stock, "delivery_days": delivery_days}


def call(name, tool_input, call_id="toolu_1"):
    return {"type": "tool_use", "id": call_id, "name": name, "input": tool_input}


@test("runs the named tool with its input and returns the result as text")
def _():
    result = run_tool(call("check_stock", {"product": "blue mug"}), TOOLS)
    assert result == {"type": "tool_result", "tool_use_id": "toolu_1", "content": "4"}


@test("passes every input as a keyword argument")
def _():
    result = run_tool(call("delivery_days", {"postcode": "LS1", "express": True}, "toolu_7"), TOOLS)
    assert result["content"] == "1"
    assert result["tool_use_id"] == "toolu_7"


@test("an unknown tool is an error result, not a crash")
def _():
    result = run_tool(call("delete_account", {"user": "ana"}), TOOLS)
    assert result["is_error"] is True
    assert "delete_account" in result["content"]
    assert result["tool_use_id"] == "toolu_1"


@test("a tool that raises becomes an error result with the message")
def _():
    result = run_tool(call("check_stock", {"product": "green mug"}), TOOLS)
    assert result["is_error"] is True
    assert "No product called green mug" in result["content"]


@test("wrong arguments from the model become an error result too")
def _():
    result = run_tool(call("check_stock", {"item": "blue mug"}), TOOLS)
    assert result["is_error"] is True


@test("a successful result has no is_error flag")
def _():
    result = run_tool(call("check_stock", {"product": "red mug"}), TOOLS)
    assert "is_error" not in result
    assert result["content"] == "0"
