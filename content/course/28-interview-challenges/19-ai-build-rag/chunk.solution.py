from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str


# Windows of `size` words that start `size - overlap` words apart. The last window stops at
# the end of the text, so no chunk is a tail already covered by the one before it.
def chunk(doc_id: str, text: str, size: int, overlap: int) -> list[Chunk]:
    if size < 1 or overlap < 0 or overlap >= size:
        raise ValueError("size must be 1 or more, and overlap between 0 and size - 1")
    # split() with no argument splits on any run of whitespace and drops the edges.
    words = text.split()
    step = size - overlap
    chunks: list[Chunk] = []
    for start in range(0, len(words), step):
        chunks.append(Chunk(f"{doc_id}#{len(chunks)}", " ".join(words[start : start + size])))
        if start + size >= len(words):
            break
    return chunks
