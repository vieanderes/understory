from collections import defaultdict


def pass_rates(results):
    passed = defaultdict(int)
    total = defaultdict(int)
    for result in results:
        total[result["slice"]] += 1
        passed[result["slice"]] += result["passed"]
    return {name: passed[name] / total[name] for name in total}


def regressions(before, after, tolerance=0.05):
    old, new = pass_rates(before), pass_rates(after)
    # A slice that vanished from the new run can't prove it still works.
    return sorted(name for name in old if name not in new or new[name] < old[name] - tolerance)
