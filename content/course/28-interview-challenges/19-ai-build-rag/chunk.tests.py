from solution import Chunk, chunk


@test("windows overlap by the given number of words")
def _():
    text = "guests may cancel free of charge until noon the day before arrival"
    assert chunk("policy", text, 4, 1) == [
        Chunk("policy#0", "guests may cancel free"),
        Chunk("policy#1", "free of charge until"),
        Chunk("policy#2", "until noon the day"),
        Chunk("policy#3", "day before arrival"),
    ]


@test("a text shorter than one chunk gives one chunk")
def _():
    assert chunk("note", "doors open at six", 10, 2) == [Chunk("note#0", "doors open at six")]


@test("no tail chunk that the one before already covers")
def _():
    chunks = chunk("menu", "one two three four five six", 4, 2)
    assert [c.text for c in chunks] == ["one two three four", "three four five six"]


@test("extra spaces and line breaks count as one gap")
def _():
    assert chunk("faq", "  refunds take\n\nfive   days ", 3, 0) == [
        Chunk("faq#0", "refunds take five"),
        Chunk("faq#1", "days"),
    ]


@test("empty text gives no chunks")
def _():
    assert chunk("blank", "   ", 5, 1) == []


@test("an overlap as big as the size is rejected")
def _():
    expect(lambda: chunk("doc", "a b c", 3, 3)).to_raise(ValueError)


@test("large: 200,000 words chunk quickly")
def _():
    words = [f"w{i % 97}" for i in range(200_000)]
    chunks = chunk("big", " ".join(words), 200, 40)
    assert len(chunks) == 1250
    assert chunks[1].text.split(" ")[0] == "w63"
