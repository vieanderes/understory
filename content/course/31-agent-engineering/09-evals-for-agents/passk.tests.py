from solution import evaluate, trajectory_ok

REQUIRED = ["verify_rider", "end_ride"]
FORBIDDEN = ["cancel_membership"]
GOOD = ["verify_rider", "lookup_ride", "end_ride"]


def trials(task, outcomes, calls=GOOD):
    return [
        {"id": f"{task}-{i}", "task": task, "outcome": ok, "calls": calls}
        for i, ok in enumerate(outcomes)
    ]


@test("required calls must appear in order, with others allowed between")
def _():
    assert trajectory_ok(GOOD, REQUIRED, FORBIDDEN) is True
    assert trajectory_ok(["end_ride", "verify_rider"], REQUIRED, FORBIDDEN) is False
    assert trajectory_ok(["verify_rider"], REQUIRED, FORBIDDEN) is False


@test("a forbidden call fails the trajectory, even when undone later")
def _():
    calls = ["verify_rider", "cancel_membership", "restore_membership", "end_ride"]
    assert trajectory_ok(calls, REQUIRED, FORBIDDEN) is False


@test("pass@k and pass^k for one task with 3 of 4 trials passing")
def _():
    got = evaluate(trials("dock-14", [True, True, True, False]), 2, REQUIRED, FORBIDDEN)
    assert got["pass_at_k"] == 1.0
    assert got["pass_hat_k"] == 0.5


@test("scores are averaged over tasks")
def _():
    data = trials("dock-14", [True] * 4) + trials("flat-tyre", [True, False, False, False])
    got = evaluate(data, 2, REQUIRED, FORBIDDEN)
    assert got["pass_at_k"] == 0.75
    assert got["pass_hat_k"] == 0.5


@test("a good outcome with a bad trajectory counts as a failure, and is listed")
def _():
    bad = ["verify_rider", "cancel_membership", "end_ride"]
    data = trials("dock-14", [True, True]) + [
        {"id": "dock-14-x", "task": "dock-14", "outcome": True, "calls": bad}
    ]
    got = evaluate(data, 3, REQUIRED, FORBIDDEN)
    assert got["bad_trajectories"] == ["dock-14-x"]
    assert got["pass_hat_k"] == 0.0
    assert got["pass_at_k"] == 1.0


@test("a task with fewer than k trials raises ValueError")
def _():
    expect(lambda: evaluate(trials("dock-14", [True, True]), 3, REQUIRED, FORBIDDEN)).to_raise(ValueError)
