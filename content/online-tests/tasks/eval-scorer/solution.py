def solution(B, C, D):
    def parse(entries):
        rows = {}
        for entry in entries:
            case_id, slice_name, trials = entry.split(' ')
            rows[case_id] = (slice_name, 'P' in trials, 'F' not in trials)
        return rows

    base = parse(B)
    cand = parse(C)
    shared = [case_id for case_id in cand if case_id in base]

    def pct(count, total):
        return 100 * count // total

    def count(rows, ids, key):
        return sum(1 for case_id in ids if rows[case_id][key])

    n = len(shared)
    summary = [
        'pass@k %d %d' % (pct(count(base, shared, 1), n), pct(count(cand, shared, 1), n)),
        'pass^k %d %d' % (pct(count(base, shared, 2), n), pct(count(cand, shared, 2), n)),
    ]
    by_slice = {}
    for case_id in shared:
        by_slice.setdefault(cand[case_id][0], []).append(case_id)
    for slice_name in sorted(by_slice):
        ids = by_slice[slice_name]
        before = count(base, ids, 2)
        after = count(cand, ids, 2)
        # Exact comparison by cross-multiplying: (before - after) / n > D / 100.
        if (before - after) * 100 > D * len(ids):
            summary.append('regressed %s %d %d' % (slice_name, pct(before, len(ids)), pct(after, len(ids))))
    if len(summary) == 2:
        summary.append('no regressions')
    return summary
