import asyncio

from solution import classify_all


def fake_model():
    """A fake async model call that counts how many calls wait at once."""
    seen = {"now": 0, "peak": 0}

    async def classify(review):
        seen["now"] += 1
        seen["peak"] = max(seen["peak"], seen["now"])
        # Longer reviews take longer, so they finish out of order.
        await asyncio.sleep(0.01 * len(review))
        seen["now"] -= 1
        return review.upper()

    return classify, seen


@test("returns every label, in the order of the reviews")
async def _():
    classify, _seen = fake_model()
    labels = await classify_all(["slow one", "ok", "mid"], classify, 3)
    assert labels == ["SLOW ONE", "OK", "MID"]


@test("runs up to the limit at once, not one by one")
async def _():
    classify, seen = fake_model()
    await classify_all(["a", "b", "c", "d", "e", "f", "g"], classify, 3)
    assert seen["peak"] == 3


@test("never runs more than the limit")
async def _():
    classify, seen = fake_model()
    await classify_all(["a", "b", "c", "d"], classify, 2)
    assert seen["peak"] == 2


@test("no reviews, no calls")
async def _():
    classify, seen = fake_model()
    assert await classify_all([], classify, 5) == []
    assert seen["peak"] == 0
