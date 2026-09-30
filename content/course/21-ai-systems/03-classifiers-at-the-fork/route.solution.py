def route_ticket(t):
    if not t["category"]:
        raise ValueError("category needs at least one label")
    if t["legal_threat"] > 0.5:
        return "escalate-legal"
    label = max(t["category"], key=t["category"].get)
    p = t["category"][label]
    if label == "spam" and p >= 0.95:
        return "discard"
    if label == "refund" and p >= 0.9:
        return "auto-refund"
    if t["needs_human"] >= 0.5 or p < 0.6:
        return "human-queue"
    if t["urgency"] >= 4:
        return "draft-reply-urgent"
    return "draft-reply"
