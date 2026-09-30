from solution import trim_history

SYSTEM = ("system", "Answer in one sentence.")
CHAT = [SYSTEM, ("user", "Hi"), ("assistant", "Hello"), ("user", "What is a token?")]


@test("keeps the system prompt and the last messages")
def _():
    expect(trim_history(CHAT, 2)).to_equal([SYSTEM, ("assistant", "Hello"), ("user", "What is a token?")])


@test("keep 1 leaves the system prompt and the newest message")
def _():
    expect(trim_history(CHAT, 1)).to_equal([SYSTEM, ("user", "What is a token?")])


@test("asking to keep more than there is keeps everything")
def _():
    expect(trim_history(CHAT, 10)).to_equal(CHAT)


@test("returns a new list and leaves the history unchanged")
def _():
    history = list(CHAT)
    result = trim_history(history, 1)
    assert result is not history
    expect(history).to_equal(CHAT)
