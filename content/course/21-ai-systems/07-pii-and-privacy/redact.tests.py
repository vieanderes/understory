from solution import redact_pii


@test("an email address becomes [EMAIL]")
def _():
    assert redact_pii("Write to mia+shop@mail.example.co.uk today") == "Write to [EMAIL] today"


@test("a phone number with spaces becomes [PHONE]")
def _():
    assert redact_pii("Call +44 20 7946 0958 after six") == "Call [PHONE] after six"


@test("a phone number with hyphens becomes [PHONE]")
def _():
    assert redact_pii("Or 030-1234-5678 at work") == "Or [PHONE] at work"


@test("an IBAN written in groups of four becomes [IBAN]")
def _():
    assert redact_pii("Refund to DE89 3704 0044 0532 0130 00 please") == "Refund to [IBAN] please"


@test("an IBAN without spaces becomes [IBAN], not [PHONE]")
def _():
    assert redact_pii("IBAN: GB33BUKB20201555555555") == "IBAN: [IBAN]"


@test("short numbers and dates are left alone")
def _():
    assert redact_pii("Order 12345 shipped on 2026-09-23") == "Order 12345 shipped on 2026-09-23"


@test("several kinds in one message are all replaced")
def _():
    assert redact_pii("ana@example.com, 0151 2345 6789, NL91ABNA0417164300") == "[EMAIL], [PHONE], [IBAN]"
