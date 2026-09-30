RULES = (
    "Answer only from the numbered sources. Cite them like [1]. "
    "If the sources don't answer the question, say you don't know."
)
NOT_FOUND = "I couldn't find that in our help pages."


def answer(question, search, ask_model, min_score=0.5, k=3):
    # Your code here
    return ask_model(system=RULES, prompt=question)
