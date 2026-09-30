import json
from pathlib import Path

from solution import load_scores, save_scores


@test("a saved dict loads back the same")
def _():
    save_scores("round-trip.json", {"ana": 7, "ben": 4})
    expect(load_scores("round-trip.json")).to_equal({"ana": 7, "ben": 4})


@test("the file holds valid JSON")
def _():
    save_scores("valid.json", {"passed": True, "note": None})
    expect(json.loads(Path("valid.json").read_text())).to_equal({"passed": True, "note": None})


@test("a missing file loads as an empty dict")
def _():
    expect(load_scores("never-saved.json")).to_equal({})
