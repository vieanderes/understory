def solution(P, F, Q, T):
    # Dicts keep the last row per id and give O(1) lookups: O(N + M) plus sorting the output.
    before = {}
    for record_id, content in P:
        before[record_id] = content
    after = {}
    for record_id, content in F:
        after[record_id] = content
    created = []
    updated = []
    for record_id, content in after.items():
        old = before.get(record_id)
        if old is None:
            created.append(record_id)
        elif old != content:
            updated.append(record_id)
    deleted = [record_id for record_id in before if record_id not in after]
    changes = ['create ' + str(i) for i in sorted(created)]
    changes += ['update ' + str(i) for i in sorted(updated)]
    if len(before) > T and len(after) * 100 < Q * len(before):
        changes.append('abort ' + str(len(deleted)))
    else:
        changes += ['delete ' + str(i) for i in sorted(deleted)]
    return changes
