import re

from solution import REFUSAL, Answer, Chunk, Deps, answer

# A fake embedder: one dimension per word in a small vocabulary, counting occurrences.
VOCAB = ["late", "checkout", "fee", "pool", "opens", "breakfast", "served", "parking", "free"]


async def embed(text):
    words = re.split(r"\W+", text.lower())
    return [words.count(term) for term in VOCAB]


def fake_model(reply):
    """A fake model that records every prompt and answers with a fixed line."""
    prompts = []

    async def generate(prompt):
        prompts.append(prompt)
        return reply

    return prompts, generate


CHUNKS = [
    Chunk("hotel#0", "Breakfast is served from seven."),
    Chunk("hotel#1", "Late checkout costs a fee of 20 pounds."),
    Chunk("hotel#2", "The pool opens at nine."),
    Chunk("hotel#3", "Parking is free for guests."),
]


@test("answers from the best chunk and cites it")
async def _():
    _prompts, generate = fake_model(" Late checkout costs 20 pounds. ")
    result = await answer("Is there a fee for late checkout?", CHUNKS, Deps(embed, generate, k=2, threshold=0.5))
    assert result == Answer("Late checkout costs 20 pounds.", ["hotel#1"])


@test("the prompt holds kept chunks with their ids, then the question")
async def _():
    prompts, generate = fake_model("Nine.")
    await answer("When does the pool open?", CHUNKS, Deps(embed, generate, k=3, threshold=0.5))
    assert prompts == ["[hotel#2] The pool opens at nine.\n\nQuestion: When does the pool open?"]


@test("refuses without calling the model when nothing scores high enough")
async def _():
    prompts, generate = fake_model("Probably yes.")
    result = await answer("Do you allow dogs?", CHUNKS, Deps(embed, generate, k=3, threshold=0.5))
    assert result == Answer(REFUSAL, [])
    assert len(prompts) == 0


@test("keeps at most k chunks, best first")
async def _():
    _prompts, generate = fake_model("Yes.")
    result = await answer("free parking, late checkout fee, breakfast?", CHUNKS, Deps(embed, generate, k=2, threshold=0.1))
    assert result.citations == ["hotel#1", "hotel#3"]


@test("a chunk with no known words scores zero instead of breaking the sort")
async def _():
    _prompts, generate = fake_model("From seven.")
    with_empty = [Chunk("hotel#9", "---"), *CHUNKS]
    result = await answer("When is breakfast served?", with_empty, Deps(embed, generate, k=1, threshold=0.5))
    assert result.citations == ["hotel#0"]


@test("a question with no known words refuses")
async def _():
    _prompts, generate = fake_model("Guessing.")
    result = await answer("???", CHUNKS, Deps(embed, generate, k=3, threshold=0.1))
    assert result.text == REFUSAL
