from solution import gate

CONTRACT = {
    "required": ["test", "typecheck", "lint"],
    "allowed": ["src/orders/", "tests/orders/"],
    "forbidden": ["src/billing/", "migrations/"],
}
GREEN = {"test": 0, "typecheck": 0, "lint": 0}


@test("a green run inside the scope has no problems")
def _():
    assert gate(CONTRACT, GREEN, ["src/orders/search.py", "tests/orders/test_search.py"]) == []


@test("a check that never ran blocks, even if the agent says it passed")
def _():
    assert gate(CONTRACT, {"test": 0, "lint": 0}, []) == ["not run: typecheck"]


@test("a non-zero exit code is a failure")
def _():
    assert gate(CONTRACT, {**GREEN, "lint": 1}, []) == ["failed: lint"]


@test("a forbidden path is reported as forbidden")
def _():
    assert gate(CONTRACT, GREEN, ["migrations/0042_add_index.sql"]) == ["forbidden: migrations/0042_add_index.sql"]


@test("a path outside every allowed prefix is out of scope")
def _():
    assert gate(CONTRACT, GREEN, ["README.md"]) == ["out of scope: README.md"]


@test("checks come first, then paths in the order they changed")
def _():
    result = gate(CONTRACT, {"test": 2, "typecheck": 0}, ["src/billing/tax.py", "src/orders/search.py", "package.json"])
    assert result == ["failed: test", "not run: lint", "forbidden: src/billing/tax.py", "out of scope: package.json"]
