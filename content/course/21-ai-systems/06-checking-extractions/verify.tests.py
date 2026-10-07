from datetime import date

from solution import check_extraction

TODAY = date(2026, 10, 7)
TEXT = "Gallery Prints Ltd\nInvoice no. MS-2041\nDate 14/09/2026\nPostcards 40.00\nPosters 142.40\nTotal 182.40"


def doc(**changes):
    base = {
        "invoice_number": "MS-2041",
        "invoice_date": "2026-09-14",
        "total": "182.40",
        "lines": [{"amount": "40.00"}, {"amount": "142.40"}],
    }
    return {**base, **changes}


@test("a clean extraction has no issues")
def _():
    assert check_extraction(doc(), TEXT, TODAY) == []


@test("a missing field is reported, and not looked up in the text")
def _():
    assert check_extraction(doc(invoice_number=""), TEXT, TODAY) == ["missing:invoice_number"]


@test("a number found only inside a longer one is not in the source")
def _():
    text = TEXT.replace("MS-2041", "MS-20417")
    assert check_extraction(doc(), text, TODAY) == ["not-in-source:invoice_number"]


@test("totals are compared exactly, within the tolerance")
def _():
    assert check_extraction(doc(total="182.50"), TEXT, TODAY) == ["total-mismatch"]
    assert check_extraction(doc(total="182.41"), TEXT, TODAY) == []
    tiny = doc(total="0.30", lines=[{"amount": "0.10"}, {"amount": "0.20"}])
    assert check_extraction(tiny, TEXT, TODAY, tolerance="0") == []


@test("a date in the future or over a year old is out of range")
def _():
    assert check_extraction(doc(invoice_date="2062-09-14"), TEXT, TODAY) == ["date-out-of-range"]
    assert check_extraction(doc(invoice_date="2025-09-14"), TEXT, TODAY) == ["date-out-of-range"]


@test("a date that isn't a date is reported")
def _():
    assert check_extraction(doc(invoice_date="14th Sept"), TEXT, TODAY) == ["bad-date"]


@test("several issues come back in the order of the checks")
def _():
    bad = doc(invoice_number="MS-2047", invoice_date="2062-09-14", total="190.00")
    assert check_extraction(bad, TEXT, TODAY) == [
        "not-in-source:invoice_number", "date-out-of-range", "total-mismatch",
    ]
