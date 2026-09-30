from solution import judge_report


def item(id, human, judge):
    return {"id": id, "human": human, "judge": judge}


LAZY = [item(f"r{n}", "fail" if n in (3, 7) else "pass", "pass") for n in range(1, 11)]


@test("a judge that passes everything misses every failure")
def _():
    report = judge_report(LAZY)
    assert report["missed"] == ["r3", "r7"]
    assert report["fail_recall"] == 0


@test("false alarms are passes the judge failed")
def _():
    items = [item("a", "pass", "fail"), item("b", "fail", "fail"), item("c", "pass", "pass")]
    assert judge_report(items) == {"missed": [], "false_alarms": ["a"], "fail_recall": 1}


@test("fail recall is the share of failures the judge caught")
def _():
    items = [item("a", "fail", "fail"), item("b", "fail", "pass"), item("c", "fail", "fail"), item("d", "fail", "pass")]
    report = judge_report(items)
    assert report["missed"] == ["b", "d"]
    assert report["fail_recall"] == 0.5


@test("with no failures, fail recall is None")
def _():
    assert judge_report([item("a", "pass", "pass")])["fail_recall"] is None
    assert judge_report([]) == {"missed": [], "false_alarms": [], "fail_recall": None}
