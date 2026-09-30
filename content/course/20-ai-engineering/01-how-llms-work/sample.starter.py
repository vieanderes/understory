import math
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class SampleOptions:
    temperature: float = 1.0
    top_k: float = math.inf
    top_p: float = 1.0


def softmax(logits: list[float]) -> list[float]:
    exps = [math.exp(logit) for logit in logits]
    total = sum(exps)
    return [e / total for e in exps]


def sample(logits: list[float], options: SampleOptions, random: Callable[[], float]) -> int:
    # Always the likeliest token. Add temperature, top-k, top-p and a weighted draw.
    probs = softmax(logits)
    return probs.index(max(probs))
