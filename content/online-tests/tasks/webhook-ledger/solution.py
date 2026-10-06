def solution(E, D, V, X):
    # A set of event ids and a dict of record states keep every webhook O(1).
    seen = set()
    records = {}
    duplicates = 0
    stale = 0
    for k in range(len(E)):
        if E[k] in seen:
            duplicates += 1
            continue
        seen.add(E[k])
        current = records.get(D[k])
        if current is not None and current[0] >= V[k]:
            stale += 1
            continue
        records[D[k]] = (V[k], X[k])
    rows = [[duplicates, stale]]
    for record_id in sorted(records):
        version, value = records[record_id]
        rows.append([record_id, version, value])
    return rows
