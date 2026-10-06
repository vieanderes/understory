import re
from datetime import date, timedelta
from decimal import Decimal

REQUIRED = ("invoice_number", "invoice_date", "total")


def check_extraction(doc, source_text, today, tolerance="0.01"):
    # Return a list of issues. An empty list means the extraction can be booked.
    issues = [f"missing:{field}" for field in REQUIRED if not doc.get(field)]
    return issues
