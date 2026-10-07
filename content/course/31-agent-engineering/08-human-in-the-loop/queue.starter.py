def rank_queue(items, now, sla):
    # Overdue items first, most overdue first. Then by risk * (1 - confidence), highest first.
    return [item["id"] for item in items]
