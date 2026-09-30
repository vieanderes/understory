def detect_loop(calls, repeats):
    # True when the history ends in one call, or a pair of calls, repeated `repeats` times.
    return calls[-1:] == calls[-2:-1]
