import codecs


class SseParser:
    """Turns chunks of bytes into server-sent events.

    `decoder` is an incremental UTF-8 decoder: codecs.getincrementaldecoder("utf-8")().
    """

    def __init__(self, decoder: codecs.IncrementalDecoder):
        self._decoder = decoder
        self._buffer = ""
        # True once the stream has sent `data: [DONE]`.
        self.done = False

    def push(self, chunk: bytes) -> list[str]:
        """Feeds the next chunk of bytes and returns the data of every event it completed."""
        if self.done:
            return []
        # final=False keeps a character split across two chunks until its last byte arrives.
        self._buffer += self._decoder.decode(chunk, final=False)
        *blocks, self._buffer = self._buffer.split("\n\n")
        # The last block may be half an event, so it waits in the buffer for the next chunk.
        events = []
        for block in blocks:
            lines = [line[5:].removeprefix(" ") for line in block.split("\n") if line.startswith("data:")]
            data = "\n".join(lines)
            if data == "":
                continue
            if data == "[DONE]":
                self.done = True
                break
            events.append(data)
        return events
