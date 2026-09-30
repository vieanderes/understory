def rank_open(assumptions):
    untested = [a for a in assumptions if not a["tested"]]
    ranked = sorted(
        untested,
        key=lambda a: (a["impact"] * a["uncertainty"], a["irreversible"]),
        reverse=True,
    )
    return [a["claim"] for a in ranked]
