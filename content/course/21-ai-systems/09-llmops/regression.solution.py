from collections import defaultdict


def find_regression(traces, drop=0.1):
    scores = defaultdict(list)
    for trace in traces:
        # A dict keeps insertion order, so versions stay in the order they shipped.
        scores[trace["prompt_version"]].append(trace["score"])
    means = [(version, sum(s) / len(s)) for version, s in scores.items()]
    for (_, before), (version, after) in zip(means, means[1:]):
        if before - after > drop:
            return version
    return None
