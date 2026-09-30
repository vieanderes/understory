from solution import chunk_words

TEXT = "one two three four five six seven eight nine ten"


@test("splits into chunks of size words, with no overlap")
def _():
    assert chunk_words(TEXT, 5, 0) == [
        "one two three four five",
        "six seven eight nine ten",
    ]


@test("each chunk repeats the last overlap words of the one before")
def _():
    assert chunk_words(TEXT, 4, 1) == [
        "one two three four",
        "four five six seven",
        "seven eight nine ten",
    ]


@test("the last chunk may be shorter, and is never dropped")
def _():
    assert chunk_words(TEXT, 4, 0) == [
        "one two three four",
        "five six seven eight",
        "nine ten",
    ]


@test("stops once a chunk reaches the end")
def _():
    chunks = chunk_words(TEXT, 6, 3)
    assert chunks == [
        "one two three four five six",
        "four five six seven eight nine",
        "seven eight nine ten",
    ]


@test("a short text is one chunk")
def _():
    assert chunk_words("Refunds take five days.", 50, 10) == ["Refunds take five days."]


@test("empty text gives no chunks")
def _():
    assert chunk_words("   ", 5, 1) == []


@test("an overlap as big as the size is refused")
def _():
    expect(lambda: chunk_words(TEXT, 3, 3)).to_raise(ValueError)
