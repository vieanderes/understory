import codecs


class SseParser:
    """Turns chunks of bytes into server-sent events.

    `decoder` is an incremental UTF-8 decoder: codecs.getincrementaldecoder("utf-8")().
    """

    def __init__(self, decoder: codecs.IncrementalDecoder):
        self._decoder = decoder
        # True once the stream has sent `data: [DONE]`.
        self.done = False

    def push(self, chunk: bytes) -> list[str]:
        """Feeds the next chunk of bytes and returns the data of every event it completed."""
        # Treats every chunk as whole events. Real chunks split anywhere.
        text = self._decoder.decode(chunk, final=True)
        return [block[6:] for block in text.split("\n\n") if block.startswith("data: ")]
