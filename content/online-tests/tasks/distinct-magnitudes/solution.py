def solution(A):
    # A set keeps each magnitude once: O(N).
    return len({abs(value) for value in A})
