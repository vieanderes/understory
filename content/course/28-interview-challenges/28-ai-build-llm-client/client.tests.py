import asyncio

from solution import Client


async def turns(count):
    """Lets other work run for a few turns, so calls overlap the way network calls do."""
    for _ in range(count):
        await asyncio.sleep(0)


def fake_model(delay=lambda prompt: 3):
    """A fake model that shouts the prompt back, and counts what it was asked."""
    asked = []
    seen = {"now": 0, "most": 0}

    async def call(prompt):
        asked.append(prompt)
        seen["now"] += 1
        seen["most"] = max(seen["most"], seen["now"])
        await turns(delay(prompt))
        seen["now"] -= 1
        return prompt.upper()

    return call, asked, seen


@test("identical prompts asked at the same time share one call")
async def _():
    call, asked, _seen = fake_model()
    client = Client(call)
    answers = await asyncio.gather(client.complete("summarise the refund policy"), client.complete("summarise the refund policy"))
    assert answers == ["SUMMARISE THE REFUND POLICY", "SUMMARISE THE REFUND POLICY"]
    assert len(asked) == 1


@test("a finished answer is served again without a call")
async def _():
    call, asked, _seen = fake_model()
    client = Client(call)
    await client.complete("translate hello")
    assert await client.complete("translate hello") == "TRANSLATE HELLO"
    assert len(asked) == 1


@test("a failure is forgotten, so the next caller tries again")
async def _():
    calls = []

    async def call(prompt):
        calls.append(prompt)
        if len(calls) == 1:
            raise RuntimeError("overloaded")
        return prompt.upper()

    client = Client(call)
    first = ""
    try:
        await client.complete("tag this ticket")
    except RuntimeError as error:
        first = str(error)
    assert first == "overloaded"
    assert await client.complete("tag this ticket") == "TAG THIS TICKET"
    assert len(calls) == 2


@test("complete_many keeps the order of the prompts")
async def _():
    # Longer prompts take longer, so they finish out of order.
    call, _asked, _seen = fake_model(lambda prompt: 20 - len(prompt))
    client = Client(call)
    prompts = ["a", "bbbbbbb", "cc", "dddddddddddd", "eee"]
    assert await client.complete_many(prompts, 2) == ["A", "BBBBBBB", "CC", "DDDDDDDDDDDD", "EEE"]


@test("complete_many never runs more than `limit` calls at once")
async def _():
    call, asked, seen = fake_model()
    client = Client(call)
    await client.complete_many(["one", "two", "three", "four", "five", "six", "seven"], 3)
    assert seen["most"] == 3
    assert len(asked) == 7


@test("a prompt repeated in complete_many reaches the model once")
async def _():
    call, asked, _seen = fake_model()
    client = Client(call)
    assert await client.complete_many(["yes", "no", "yes"], 3) == ["YES", "NO", "YES"]
    assert asked == ["yes", "no"]


@test("an empty list gives an empty list and no calls")
async def _():
    call, asked, _seen = fake_model()
    client = Client(call)
    assert await client.complete_many([], 4) == []
    assert len(asked) == 0
