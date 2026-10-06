def solution(R, C, P):
    # Compare whole (second, id) pairs, so records sharing the cursor's second are neither
    # skipped nor repeated, and a deleted cursor record still marks the position.
    page = []
    for second, record_id in R:
        if len(page) == P:
            break
        if not C or (second, record_id) > (C[0], C[1]):
            page.append(record_id)
    return page
