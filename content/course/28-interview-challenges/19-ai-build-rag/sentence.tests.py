from solution import chunk_sentences


@test("packs whole sentences and repeats the last one in the next chunk")
def _():
    text = "Check in opens at noon. Bags go on the belt. Show your pass at the gate! Board?"
    assert chunk_sentences(text, 50) == [
        "Check in opens at noon. Bags go on the belt.",
        "Bags go on the belt. Show your pass at the gate!",
        "Show your pass at the gate! Board?",
    ]


@test("text that fits is one chunk")
def _():
    assert chunk_sentences("Doors open at six. The show starts at seven.", 100) == [
        "Doors open at six. The show starts at seven.",
    ]


@test("a sentence longer than the limit stays whole, once")
def _():
    long = "This one sentence about the refund policy is far longer than the limit."
    assert chunk_sentences(f"Short one. {long} Short two.", 30) == ["Short one.", long, "Short two."]


@test("the overlap is left out when it would not fit")
def _():
    assert chunk_sentences("Pay at the desk. Collect your key from the night porter.", 45) == [
        "Pay at the desk.",
        "Collect your key from the night porter.",
    ]


@test("no chunk passes the limit unless it is one long sentence")
def _():
    text = "One. Two two. Three three three. Four four four four. Five. Six six. Seven."
    for piece in chunk_sentences(text, 25):
        assert len(piece) <= 25


@test("text after the last full stop is a sentence too")
def _():
    assert chunk_sentences("Rooms are cleaned daily. Towels on request", 30) == [
        "Rooms are cleaned daily.",
        "Towels on request",
    ]


@test("empty text gives no chunks")
def _():
    assert chunk_sentences("   ", 50) == []
