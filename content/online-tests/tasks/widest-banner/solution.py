def solution(H):
    # A stack of indices with rising heights finds both edges of every banner: O(N).
    stack = []
    best = 0
    n = len(H)
    for i in range(n + 1):
        height = H[i] if i < n else 0
        while stack and H[stack[-1]] >= height:
            top = stack.pop()
            left = stack[-1] if stack else -1
            area = H[top] * (i - left - 1)
            if area > best:
                best = area
        stack.append(i)
    return best
