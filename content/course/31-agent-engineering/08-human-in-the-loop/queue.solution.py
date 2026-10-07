def rank_queue(items, now, sla):
    overdue, waiting = [], []
    for item in items:
        if item["risk"] not in sla:
            raise ValueError(f"no SLA for risk {item['risk']}")
        age = now - item["created"]
        late_by = age - sla[item["risk"]]
        if late_by >= 0:
            overdue.append((-late_by, item["id"]))
        else:
            # The expected harm of a wrong approval: how bad, times how unsure.
            score = item["risk"] * (1 - item["confidence"])
            waiting.append((-score, -age, item["id"]))
    return [entry[-1] for entry in sorted(overdue)] + [entry[-1] for entry in sorted(waiting)]
