from solution import NOT_FOUND, RULES, answer

RESULTS = [
    (0.91, "Refunds take five working days."),
    (0.78, "Return an item within 30 days."),
    (0.62, "Refunds go back to the card you paid with."),
    (0.55, "Gift cards can't be refunded."),
    (0.21, "We open at 9."),
]


def fake_search(results):
    def search(question):
        search.asked = question
        return results
    return search


def fake_model(reply="Five working days [1]."):
    def ask_model(system, prompt):
        ask_model.calls.append({"system": system, "prompt": prompt})
        return reply
    ask_model.calls = []
    return ask_model


@test("returns the model's answer")
def _():
    model = fake_model()
    assert answer("How long do refunds take?", fake_search(RESULTS), model) == "Five working days [1]."


@test("searches with the question")
def _():
    search = fake_search(RESULTS)
    answer("How long do refunds take?", search, fake_model())
    assert search.asked == "How long do refunds take?"


@test("numbers the top k relevant sources, best first, then asks the question")
def _():
    model = fake_model()
    answer("How long do refunds take?", fake_search(RESULTS), model)
    prompt = model.calls[0]["prompt"]
    assert prompt == (
        "[1] Refunds take five working days.\n"
        "[2] Return an item within 30 days.\n"
        "[3] Refunds go back to the card you paid with.\n"
        "\n"
        "Question: How long do refunds take?"
    )


@test("sends the grounding rules as the system prompt")
def _():
    model = fake_model()
    answer("How long do refunds take?", fake_search(RESULTS), model)
    assert model.calls[0]["system"] == RULES


@test("leaves out results below min_score")
def _():
    model = fake_model()
    answer("Opening hours?", fake_search(RESULTS), model, min_score=0.7, k=5)
    assert "[3]" not in model.calls[0]["prompt"]
    assert "We open at 9." not in model.calls[0]["prompt"]


@test("with nothing relevant, says so without calling the model")
def _():
    model = fake_model()
    result = answer("Do you sell bikes?", fake_search([(0.3, "We open at 9.")]), model)
    assert result == NOT_FOUND
    assert model.calls == []
