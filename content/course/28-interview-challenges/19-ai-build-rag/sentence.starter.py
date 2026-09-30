import re


# Sentences end at . ! or ?, and any text after the last one counts as a sentence too.
def sentences(text: str) -> list[str]:
    found = re.findall(r"[^.!?]+[.!?]+|[^.!?]+$", text)
    return [s.strip() for s in found if s.strip()]


def chunk_sentences(text: str, max_chars: int) -> list[str]:
    # Cuts every max_chars characters, often in the middle of a sentence.
    return [text[start : start + max_chars].strip() for start in range(0, len(text), max_chars)]
