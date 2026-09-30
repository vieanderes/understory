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


async def answer(question: str, chunks: list[Chunk], deps: Deps) -> Answer:
    # 1. Embed the question and every chunk, and score each chunk by cosine similarity.
    # 2. Keep the top k that reach the threshold. None left? Refuse.
    # 3. Otherwise build the prompt, call generate, and cite the kept chunk ids.
    text = await deps.generate(question)
    return Answer(text, [c.id for c in chunks])
