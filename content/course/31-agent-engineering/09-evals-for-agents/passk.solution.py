from math import comb


def trajectory_ok(calls, required, forbidden):
    if any(call in forbidden for call in calls):
        return False
    remaining = iter(calls)
    # `in` on an iterator consumes it, so each required call must come after the last.
    return all(step in remaining for step in required)


def evaluate(trials, k, required, forbidden):
    by_task, bad = {}, []
    for trial in trials:
        good_path = trajectory_ok(trial["calls"], required, forbidden)
        if not good_path:
            bad.append(trial["id"])
        by_task.setdefault(trial["task"], []).append(trial["outcome"] and good_path)

    at_k, hat_k = [], []
    for task, passes in by_task.items():
        n, c = len(passes), sum(passes)
        if n < k:
            raise ValueError(f"task {task} has {n} trials, fewer than k={k}")
        at_k.append(1 - comb(n - c, k) / comb(n, k))  # at least one of k passes
        hat_k.append(comb(c, k) / comb(n, k))          # all k pass

    return {
        "pass_at_k": round(sum(at_k) / len(at_k), 3),
        "pass_hat_k": round(sum(hat_k) / len(hat_k), 3),
        "bad_trajectories": bad,
    }
