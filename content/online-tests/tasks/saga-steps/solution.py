def solution(S, R, U):
    log = []
    for k in range(len(S)):
        if R[k] == 1:
            log.append('done ' + S[k])
            continue
        log.append('failed ' + S[k])
        # Compensate newest first; the failed step changed nothing, so it is not undone.
        for j in range(k - 1, -1, -1):
            if U[j] == -1:
                continue
            if U[j] == 0:
                log.append('stuck ' + S[j])
                log.append('needs attention')
                return log
            log.append('undo ' + S[j])
        log.append('rolled back')
        return log
    log.append('committed')
    return log
