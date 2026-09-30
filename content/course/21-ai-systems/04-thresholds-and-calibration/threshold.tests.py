from solution import choose_threshold

SCORES = [0.98, 0.97, 0.95, 0.93, 0.92, 0.91, 0.88, 0.85, 0.82, 0.78,
          0.74, 0.71, 0.66, 0.62, 0.55, 0.48, 0.35, 0.22, 0.15, 0.05]
LABELS = [True, True, True, True, False, True, True, False, True, True,
          False, True, False, True, False, False, False, False, True, False]


@test("a target of 0.85 automates from 0.88 up")
def _():
    assert choose_threshold(SCORES, LABELS, 0.85) == 0.88


@test("precision rises and falls, so 0.8 reaches down to 0.78")
def _():
    assert choose_threshold(SCORES, LABELS, 0.8) == 0.78


@test("a strict target keeps only the top scores")
def _():
    assert choose_threshold(SCORES, LABELS, 0.9) == 0.93


@test("no target at all automates everything")
def _():
    assert choose_threshold(SCORES, LABELS, 0) == 0.05


@test("an impossible target gives None")
def _():
    assert choose_threshold(SCORES, LABELS, 1.01) is None
    assert choose_threshold([], [], 0.5) is None


@test("lists of different lengths raise ValueError")
def _():
    expect(lambda: choose_threshold([0.5], [], 0.5)).to_raise(ValueError)
