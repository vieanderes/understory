import re


# Sentences end at . ! or ?, and any text after the last one counts as a sentence too.
def sentences(text: str) -> list[str]:
    found = re.findall(r"[^.!?]+[.!?]+|[^.!?]+$", text)
    return [s.strip() for s in found if s.strip()]


def chunk_sentences(text: str, max_chars: int) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    for sentence in sentences(text):
        if current and len(" ".join([*current, sentence])) > max_chars:
            chunks.append(" ".join(current))
            last = current[-1]
            # Repeat the last sentence as overlap, but only if it fits beside the new one.
            current = [last, sentence] if len(f"{last} {sentence}") <= max_chars else [sentence]
        else:
            # An empty chunk takes any sentence, so one longer than the limit stays whole.
            current.append(sentence)
    if current:
        chunks.append(" ".join(current))
    return chunks
