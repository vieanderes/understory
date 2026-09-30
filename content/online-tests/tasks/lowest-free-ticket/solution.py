def solution(A):
    # A set answers "is k held?" in O(1), so the scan up from 1 is O(N) in total.
    held = set(A)
    ticket = 1
    while ticket in held:
        ticket += 1
    return ticket
