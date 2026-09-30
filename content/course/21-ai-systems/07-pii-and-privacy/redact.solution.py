import re

IBAN = re.compile(r"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+")
PHONE = re.compile(r"\+?\d(?:[ -]?\d){8,}")


def redact_pii(text):
    # IBANs first: their long digit runs would otherwise be taken for phone numbers.
    text = IBAN.sub("[IBAN]", text)
    text = EMAIL.sub("[EMAIL]", text)
    return PHONE.sub("[PHONE]", text)
