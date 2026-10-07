def compact(history, budget, count):
    pinned = sum(count(m) for m in history if m.get("pin"))
    if pinned > budget:
        raise ValueError(f"pinned messages need {pinned} tokens; the budget is {budget}")

    room = budget - pinned
    tail = []  # indexes of recent, unpinned messages, newest first
    for i in range(len(history) - 1, -1, -1):
        if history[i].get("pin"):
            continue
        if count(history[i]) > room:
            break  # no gaps: an older message never jumps the queue
        room -= count(history[i])
        tail.append(i)

    # A tool result without the call that asked for it is rejected by the API.
    while tail and history[tail[-1]]["role"] == "tool":
        tail.pop()

    keep = set(tail)
    kept = [m for i, m in enumerate(history) if m.get("pin") or i in keep]
    dropped = [m for i, m in enumerate(history) if not (m.get("pin") or i in keep)]
    return kept, dropped
