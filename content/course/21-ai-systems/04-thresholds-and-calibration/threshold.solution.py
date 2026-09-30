def choose_threshold(scores, labels, min_precision):
    if len(scores) != len(labels):
        raise ValueError("scores and labels must be the same length")
    best = None
    for t in set(scores):
        chosen = [label for score, label in zip(scores, labels) if score >= t]
        precision = sum(chosen) / len(chosen)
        # Precision rises and falls as t drops, so every candidate is checked.
        if precision >= min_precision and (best is None or t < best):
            best = t
    return best
