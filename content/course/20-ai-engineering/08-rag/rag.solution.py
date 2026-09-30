RULES = (
    "Answer only from the numbered sources. Cite them like [1]. "
    "If the sources don't answer the question, say you don't know."
)
NOT_FOUND = "I couldn't find that in our help pages."


def answer(question, search, ask_model, min_score=0.5, k=3):
    relevant = [text for score, text in search(question) if score >= min_score][:k]
    # With nothing relevant, a model would answer from memory. Don't ask it.
    if not relevant:
        return NOT_FOUND
    sources = "\n".join(f"[{n}] {text}" for n, text in enumerate(relevant, start=1))
    return ask_model(system=RULES, prompt=f"{sources}\n\nQuestion: {question}")
