def solution(A, B, C, M):
    retryable = {408, 429, 500, 502, 503, 504}
    log = []
    # Doubling and clamping each time keeps the backoff at or below C.
    backoff = B
    attempt = 1
    while True:
        parts = A[attempt - 1].split(':')
        code_text = parts[0]
        if code_text != 'timeout':
            code = int(code_text)
            if 200 <= code <= 299:
                log.append('success')
                return log
            if code not in retryable:
                log.append('fail')
                return log
        if attempt == M:
            log.append('exhausted')
            return log
        wait = int(parts[1]) if len(parts) > 1 else backoff
        log.append('wait ' + str(wait))
        backoff = min(C, backoff * 2)
        attempt += 1
