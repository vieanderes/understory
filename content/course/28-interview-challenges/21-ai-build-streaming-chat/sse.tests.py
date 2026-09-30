import codecs

from solution import SseParser


def decoder():
    # A real incremental decoder, as a network client would use.
    return codecs.getincrementaldecoder("utf-8")(errors="replace")


def feed(stream, size):
    """Feeds the stream in pieces of `size` bytes and collects every event."""
    data = stream.encode("utf-8")
    parser = SseParser(decoder())
    events = []
    for start in range(0, len(data), size):
        events.extend(parser.push(data[start : start + size]))
    return events, parser.done


STREAM = 'data: {"text":"Your order"}\n\n' 'data: {"text":" ships Monday."}\n\n' "data: [DONE]\n\n"


@test("a whole stream in one chunk gives its events, without [DONE]")
def _():
    assert feed(STREAM, 1000) == (['{"text":"Your order"}', '{"text":" ships Monday."}'], True)


@test("fed three bytes at a time, it gives the same events")
def _():
    assert feed(STREAM, 3) == feed(STREAM, 1000)


@test("every chunk size from 1 to 12 gives the same events")
def _():
    for size in range(1, 13):
        events, _done = feed(STREAM, size)
        assert len(events) == 2


@test("half an event waits until the rest arrives")
def _():
    parser = SseParser(decoder())
    assert parser.push(b'data: {"text":"Hel') == []
    assert parser.push(b'lo"}\n\n') == ['{"text":"Hello"}']


@test("a character split across chunks arrives whole")
def _():
    stream = 'data: {"text":"Café ☕"}\n\ndata: [DONE]\n\n'
    for size in range(1, 7):
        events, _done = feed(stream, size)
        assert events == ['{"text":"Café ☕"}']


@test("nothing after [DONE] is returned")
def _():
    parser = SseParser(decoder())
    assert parser.push(b'data: [DONE]\n\ndata: {"text":"late"}\n\n') == []
    assert parser.push(b'data: {"text":"later"}\n\n') == []
    assert parser.done is True


@test("other fields are skipped, and several data lines join with a newline")
def _():
    stream = ": keep-alive\n\nevent: message\nid: 7\ndata: first line\ndata:second line\n\n"
    events, _done = feed(stream, 4)
    assert events == ["first line\nsecond line"]
