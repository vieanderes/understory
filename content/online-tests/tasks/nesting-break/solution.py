def solution(S):
    # Each closing bracket must match the most recent one still open: a stack, O(N).
    opener = {")": "(", "]": "[", "}": "{"}
    stack = []
    for i, char in enumerate(S):
        wanted = opener.get(char)
        if wanted is None:
            stack.append(char)
        elif not stack or stack.pop() != wanted:
            return i
    return -1 if not stack else len(S)
