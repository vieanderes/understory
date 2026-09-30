def chunk_words(text, size, overlap):
    if not 0 <= overlap < size:
        raise ValueError("overlap must be at least 0 and less than size")
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        chunks.append(" ".join(words[start:start + size]))
        # Stop once a chunk reaches the end, or the next would sit inside this one.
        if start + size >= len(words):
            break
        start += size - overlap
    return chunks
