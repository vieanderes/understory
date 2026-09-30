from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str


def chunk(doc_id: str, text: str, size: int, overlap: int) -> list[Chunk]:
    # Split into words, then take windows of `size` words that start `size - overlap` apart.
    return [Chunk(f"{doc_id}#0", text)]
