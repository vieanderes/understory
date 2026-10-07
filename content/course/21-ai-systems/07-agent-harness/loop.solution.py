def detect_loop(calls, repeats):
    if repeats < 2:
        raise ValueError("repeats must be 2 or more")
    for cycle in (1, 2):
        needed = cycle * repeats
        if len(calls) < needed:
            continue
        tail = calls[-needed:]
        # In a repeating tail, every call equals the one `cycle` places before it.
        if all(tail[i] == tail[i - cycle] for i in range(cycle, needed)):
            return True
    return False
