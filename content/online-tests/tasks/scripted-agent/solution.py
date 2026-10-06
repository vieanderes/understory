def solution(T, W, A, K):
    writes = set(W)
    approved = set(A)
    # Only calls that actually ran count for the step cap and the loop rules.
    ran = []
    for turn in T:
        if turn == 'final':
            return 'answered ' + str(len(ran))
        if len(ran) == K:
            return 'step-cap ' + str(len(ran))
        m = len(ran)
        repeats_last = m >= 1 and turn == ran[m - 1]
        repeats_pair = m >= 3 and turn == ran[m - 2] and ran[m - 1] == ran[m - 3]
        if repeats_last or repeats_pair:
            return 'loop ' + str(m)
        tool = turn.split(' ')[0]
        if tool in writes and tool not in approved:
            return 'needs-approval ' + str(m)
        ran.append(turn)
    return 'no-answer ' + str(len(ran))
