import math


def cosine(a, b):
    """Cosine similarity of two vectors: 1 is the same direction, 0 unrelated."""
    dot = sum(x * y for x, y in zip(a, b))
    size = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / size if size else 0.0


def top_k(query_vector, passages, k):
    # sorted keeps equal scores in their original order.
    ranked = sorted(passages, key=lambda p: cosine(query_vector, p["vector"]), reverse=True)
    return [p["text"] for p in ranked[:k]]
