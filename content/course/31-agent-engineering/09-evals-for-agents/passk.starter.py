from math import comb


def trajectory_ok(calls, required, forbidden):
    # True when the required calls appear in order and no forbidden call appears.
    return True


def evaluate(trials, k, required, forbidden):
    # Return {"pass_at_k": ..., "pass_hat_k": ..., "bad_trajectories": [...]}.
    return {"pass_at_k": 0.0, "pass_hat_k": 0.0, "bad_trajectories": []}
