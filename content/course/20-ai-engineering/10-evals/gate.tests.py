from solution import regressions


def run(**slices):
    """Builds results from slice=(passed, failed) counts, like a real eval run's output."""
    results = []
    for name, (passed, failed) in slices.items():
        results += [{"slice": name, "passed": True}] * passed
        results += [{"slice": name, "passed": False}] * failed
    return results


BEFORE = run(refunds=(9, 1), delivery=(8, 2), billing=(7, 3))


@test("no change means no regressions")
def _():
    assert regressions(BEFORE, BEFORE) == []


@test("finds the slice that dropped, even when the overall rate rose")
def _():
    after = run(refunds=(4, 6), delivery=(10, 0), billing=(10, 0))
    assert regressions(BEFORE, after) == ["refunds"]


@test("a drop within the tolerance is not a regression")
def _():
    after = run(refunds=(17, 3), delivery=(8, 2), billing=(7, 3))
    assert regressions(BEFORE, after, tolerance=0.1) == []


@test("lists every regressed slice, sorted by name")
def _():
    after = run(refunds=(5, 5), delivery=(4, 6), billing=(7, 3))
    assert regressions(BEFORE, after) == ["delivery", "refunds"]


@test("a slice missing from the new run counts as regressed")
def _():
    after = run(refunds=(9, 1), delivery=(8, 2))
    assert regressions(BEFORE, after) == ["billing"]


@test("a new slice with no baseline is not a regression")
def _():
    after = run(refunds=(9, 1), delivery=(8, 2), billing=(7, 3), returns=(1, 9))
    assert regressions(BEFORE, after) == []
