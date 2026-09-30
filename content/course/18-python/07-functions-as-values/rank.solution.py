def top_ids(passages, k):
    ranked = sorted(passages, key=lambda p: p["score"], reverse=True)
    ids = []
    for passage in ranked[:k]:
        ids.append(passage["id"])
    return ids
