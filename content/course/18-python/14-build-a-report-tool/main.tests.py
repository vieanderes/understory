import json
from pathlib import Path

from solution import main


def run(argv):
    before = len(printed())
    code = main(argv)
    return code, printed()[before:]


@test("prints the report for a file and exits with 0")
def _():
    Path("results.json").write_text(json.dumps([{"id": "t1", "passed": True}, {"id": "t2", "passed": False}]))
    expect(run(["report.py", "results.json"])).to_equal((0, ["1 of 2 passed"]))


@test("no file name prints the usage and exits with 2")
def _():
    expect(run(["report.py"])).to_equal((2, ["usage: report.py FILE"]))


@test("a missing file says so and exits with 1")
def _():
    expect(run(["report.py", "missing.json"])).to_equal((1, ["No such file: missing.json"]))

