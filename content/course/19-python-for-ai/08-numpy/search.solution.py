import numpy as np


def top_k(query, passages, k):
    # Unit length first, so a dot product is the cosine of the angle.
    rows = passages / np.linalg.norm(passages, axis=1, keepdims=True)
    q = query / np.linalg.norm(query)
    scores = rows @ q
    return [int(i) for i in np.argsort(-scores)[:k]]
