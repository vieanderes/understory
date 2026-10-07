from solution import validate_args

SCHEMA = {
    "properties": {
        "ticket_id": {"type": "string"},
        "limit": {"type": "integer"},
        "status": {"type": "string", "enum": ["open", "closed"]},
    },
    "required": ["ticket_id"],
}


@test("valid arguments give no errors")
def _():
    assert validate_args(SCHEMA, {"ticket_id": "t-42", "limit": 5, "status": "open"}) == []


@test("a missing required argument is reported")
def _():
    assert validate_args(SCHEMA, {"limit": 5}) == ["missing: ticket_id"]


@test("an argument the schema doesn't list is rejected")
def _():
    assert validate_args(SCHEMA, {"ticket_id": "t-42", "delete_all": True}) == ["unknown: delete_all"]


@test("an integer must be a whole number, and not a boolean")
def _():
    assert validate_args(SCHEMA, {"ticket_id": "t-42", "limit": 2.5}) == ["type: limit"]
    assert validate_args(SCHEMA, {"ticket_id": "t-42", "limit": True}) == ["type: limit"]


@test("a value outside the enum is rejected")
def _():
    assert validate_args(SCHEMA, {"ticket_id": "t-42", "status": "deleted"}) == ["enum: status"]


@test("missing keys come first, then problems in argument order")
def _():
    assert validate_args(SCHEMA, {"status": 7, "extra": "x"}) == ["missing: ticket_id", "type: status", "unknown: extra"]
