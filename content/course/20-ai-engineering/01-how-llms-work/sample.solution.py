import math
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class SampleOptions:
    temperature: float = 1.0
    top_k: float = math.inf
    top_p: float = 1.0


# Subtracting the largest score first keeps math.exp from overflowing, and gives the same
# probabilities.
def softmax(logits: list[float]) -> list[float]:
    largest = max(logits)
    exps = [math.exp(logit - largest) for logit in logits]
    total = sum(exps)
    return [e / total for e in exps]


def sample(logits: list[float], options: SampleOptions, random: Callable[[], float]) -> int:
    if options.temperature == 0:
        return logits.index(max(logits))

    probs = softmax([logit / options.temperature for logit in logits])
    ranked = sorted(enumerate(probs), key=lambda pair: pair[1], reverse=True)

    # Top-k, then top-p: keep tokens while the running total is still under top_p.
    kept: list[tuple[int, float]] = []
    cumulative = 0.0
    for token_id, p in ranked:
        if len(kept) >= options.top_k or cumulative >= options.top_p:
            break
        kept.append((token_id, p))
        cumulative += p

    # Throw a dart along the kept probabilities, scaled to their total.
    dart = random() * cumulative
    for token_id, p in kept:
        dart -= p
        if dart <= 0:
            return token_id
    # Rounding can leave a sliver past the end.
    return kept[-1][0]
