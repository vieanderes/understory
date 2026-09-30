def solution(S):
    # The stack holds the index just before the current fragment, then every open bracket
    # still waiting for its partner. After a match, the top is where the fragment began.
    stack = [-1]
    best = 0
    for i, ch in enumerate(S):
        if ch == '(':
            stack.append(i)
        else:
            stack.pop()
            if not stack:
                stack.append(i)
            else:
                best = max(best, i - stack[-1])
    return best
