def solution(A, B):
    # A stack of the balls rolling right that nothing has stopped yet. A ball rolling left
    # meets them nearest first, so it fights the top of the stack until one side runs out.
    # Every ball is pushed and popped at most once: O(N).
    right = []
    escaped = 0
    for size, direction in zip(A, B):
        if direction == 1:
            right.append(size)
            continue
        while right:
            top = right[-1]
            if top >= size:
                right[-1] = top + size
                size = 0
                break
            size += top
            right.pop()
        if size > 0:
            escaped += 1
    return escaped + len(right)
