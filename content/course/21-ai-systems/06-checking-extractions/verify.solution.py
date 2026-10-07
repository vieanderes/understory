import re
from datetime import date, timedelta
from decimal import Decimal

REQUIRED = ("invoice_number", "invoice_date", "total")


def check_extraction(doc, source_text, today, tolerance="0.01"):
    issues = [f"missing:{field}" for field in REQUIRED if not doc.get(field)]

    number = doc.get("invoice_number")
    if number:
        # A whole word only: "MS-2041" must not pass inside "MS-20417".
        pattern = r"(?<![\w-])" + re.escape(number) + r"(?![\w-])"
        if not re.search(pattern, source_text):
            issues.append("not-in-source:invoice_number")

    if doc.get("invoice_date"):
        try:
            issued = date.fromisoformat(doc["invoice_date"])
        except ValueError:
            issues.append("bad-date")
        else:
            if issued > today or issued < today - timedelta(days=365):
                issues.append("date-out-of-range")

    if doc.get("total"):
        computed = sum((Decimal(line["amount"]) for line in doc.get("lines", [])), Decimal("0"))
        if abs(computed - Decimal(doc["total"])) > Decimal(tolerance):
            issues.append("total-mismatch")
    return issues
