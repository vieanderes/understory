def bracket_strings(n):
    result = []

    def explore(text, opened, closed):
        if len(text) == 2 * n:
            result.append(text)
            return
        # "(" sorts before ")", so trying it first keeps the output sorted.
        if opened < n:
            explore(text + "(", opened + 1, closed)
        # Pruning: a ")" is only allowed when an earlier "(" is still open.
        if closed < opened:
            explore(text + ")", opened, closed + 1)

    explore("", 0, 0)
    return result
