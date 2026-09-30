END = "<end>"


def generate(model, tokens, max_tokens):
    written = []
    while len(written) < max_tokens:
        probs = model(tokens + written)
        token = max(probs, key=probs.get)
        if token == END:
            return written, "end_turn"
        written.append(token)
    return written, "max_tokens"
