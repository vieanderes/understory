import asyncio
import math
from collections.abc import Awaitable, Callable
from dataclasses import dataclass


@dataclass(frozen=True)
class Chunk:
    id: str
    text: str


@dataclass
class Deps:
    embed: Callable[[str], Awaitable[list[float]]]
    generate: Callable[[str], Awaitable[str]]
    k: int
    threshold: float


@dataclass
class Answer:
    text: str
    citations: list[str]


REFUSAL = "I don't have that information."


# A zero vector has no direction, so it matches nothing instead of dividing by zero.
def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    return 0.0 if norm_a == 0 or norm_b == 0 else dot / (norm_a * norm_b)


async def answer(question: str, chunks: list[Chunk], deps: Deps) -> Answer:
    query_vector, *chunk_vectors = await asyncio.gather(
        deps.embed(question), *(deps.embed(c.text) for c in chunks)
    )
    scored = [(cosine(query_vector, vector), c) for c, vector in zip(chunks, chunk_vectors)]
    # sorted is stable, so equal scores keep the order the chunks came in.
    scored = sorted(scored, key=lambda pair: pair[0], reverse=True)
    kept = [c for score, c in scored[: deps.k] if score >= deps.threshold]
    # Refusing in code, before the model runs, means no prompt wording can talk it into guessing.
    if not kept:
        return Answer(REFUSAL, [])

    context = "\n".join(f"[{c.id}] {c.text}" for c in kept)
    prompt = f"{context}\n\nQuestion: {question}"
    text = (await deps.generate(prompt)).strip()
    return Answer(text, [c.id for c in kept])
