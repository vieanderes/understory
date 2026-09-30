from solution import END, generate

# A toy model: it looks only at the last token. A real one reads them all.
NEXT = {
    "The": {" cat": 0.7, " dog": 0.3},
    " cat": {" sat": 0.8, " ran": 0.2},
    " sat": {" on": 0.9, END: 0.1},
    " on": {" the": 0.95, " a": 0.05},
    " the": {" mat": 0.6, " sofa": 0.3, END: 0.1},
    " mat": {".": 0.7, END: 0.3},
    ".": {END: 1.0},
}


def toy_model(tokens):
    toy_model.calls.append(list(tokens))
    return NEXT[tokens[-1]]


def fresh():
    toy_model.calls = []
    return toy_model


@test("writes the most likely token each time, until the end token")
def _():
    written, reason = generate(fresh(), ["The"], 20)
    assert written == [" cat", " sat", " on", " the", " mat", "."]
    assert reason == "end_turn"


@test("never includes the end token in the text")
def _():
    written, reason = generate(fresh(), ["."], 20)
    assert written == []
    assert reason == "end_turn"


@test("stops at max_tokens and says so")
def _():
    written, reason = generate(fresh(), ["The"], 3)
    assert written == [" cat", " sat", " on"]
    assert reason == "max_tokens"


@test("each step sees the prompt plus everything written so far")
def _():
    model = fresh()
    generate(model, ["The"], 20)
    assert model.calls[0] == ["The"]
    assert model.calls[2] == ["The", " cat", " sat"]


@test("does not change the prompt list it was given")
def _():
    prompt = ["The"]
    generate(fresh(), prompt, 20)
    assert prompt == ["The"]
