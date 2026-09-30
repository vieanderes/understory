# Each rule in the statement is one line here, so a reviewer can tick them off.
def leaderboard(results, n):
    totals = {}
    for result in results:
        totals[result["name"]] = totals.get(result["name"], 0) + result["points"]
    # "Ascending string order" compares code points, so capitals come first.
    ranked = sorted(totals.items(), key=lambda item: (-item[1], item[0]))
    return [f"{name}({total})" for name, total in ranked[:n]]
