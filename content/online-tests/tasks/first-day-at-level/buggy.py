def solution(A, X):
    lo = 0
    hi = len(A) - 1
    answer = -1
    while lo <= hi:
        mid = (lo + hi) // 2
        if A[mid] > X:
            answer = mid
            hi = mid - 1
        else:
            lo = mid + 1
    return answer
