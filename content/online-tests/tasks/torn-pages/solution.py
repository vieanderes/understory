def solution(A):
    # The two missing numbers sum to s. The smaller is at most s // 2 and the larger is above
    # it, so the missing sum below that pivot is the smaller one alone. Two passes, O(N).
    n = len(A) + 2
    s = n * (n + 1) // 2 - sum(A)
    pivot = s // 2
    below = sum(page for page in A if page <= pivot)
    smaller = pivot * (pivot + 1) // 2 - below
    return [smaller, s - smaller]
