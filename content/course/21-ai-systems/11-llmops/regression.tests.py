from solution import find_regression


def run(version, *scores):
    return [{"prompt_version": version, "score": s} for s in scores]


@test("finds the version where the average score fell")
def _():
    traces = run("v6", 0.9, 0.8) + run("v7", 0.9, 0.9) + run("v8", 0.6, 0.7)
    assert find_regression(traces) == "v8"


@test("a small dip within the tolerance isn't a regression")
def _():
    traces = run("v6", 0.9, 0.9) + run("v7", 0.85, 0.85)
    assert find_regression(traces) is None


@test("compares each version with the one just before it")
def _():
    traces = run("v1", 0.5) + run("v2", 0.9) + run("v3", 0.7) + run("v4", 0.4)
    assert find_regression(traces) == "v3"


@test("a custom tolerance is respected")
def _():
    traces = run("v1", 0.9) + run("v2", 0.85)
    assert find_regression(traces, drop=0.01) == "v2"


@test("one version, or none, can't regress")
def _():
    assert find_regression(run("v1", 0.2, 0.3)) is None
    assert find_regression([]) is None
