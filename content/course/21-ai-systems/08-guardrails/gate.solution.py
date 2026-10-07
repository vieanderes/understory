def gate_action(p, policy):
    if not 1 <= p["risk"] <= 5:
        raise ValueError("risk must be from 1 to 5")
    # Blocking rules first: a blocked action never reaches a person's queue.
    if p["tool"] not in policy["allowed"] or p["pii_leak"] >= 0.5:
        return "block"
    if p["tool"] in policy["irreversible"] or p["risk"] >= 4 or p["matches_intent"] < 0.8:
        return "approve"
    return "run"
