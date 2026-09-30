import pandas as pd

from solution import pass_rates

RESULTS = pd.DataFrame({
    "case_id": [1, 2, 3, 4, 5, 6, 7, 8],
    "version": ["v1", "v1", "v1", "v1", "v2", "v2", "v2", "v2"],
    "category": ["refund", "refund", "billing", "billing"] * 2,
    "passed": [True, False, False, False, True, True, True, False],
})


@test("gives one pass rate per category for the version asked")
def _():
    assert pass_rates(RESULTS, "v2").to_dict() == {"billing": 0.5, "refund": 1.0}


@test("ignores the rows of other versions")
def _():
    assert pass_rates(RESULTS, "v1").to_dict() == {"billing": 0.0, "refund": 0.5}


@test("a slice can fail while the overall rate looks fine")
def _():
    rates = pass_rates(RESULTS, "v2")
    overall = RESULTS[RESULTS["version"] == "v2"]["passed"].mean()
    assert overall == 0.75
    assert rates["billing"] < 0.6
