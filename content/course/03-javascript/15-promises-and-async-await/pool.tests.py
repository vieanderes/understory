import asyncio

from solution import map_with_limit


def make_loader(ticks_for=lambda city: 3):
    """A fake loader. It counts the calls running at once and takes `ticks` turns of the loop."""
    stats = {"running": 0, "most": 0, "calls": 0}

    async def load(city, index=0):
        stats["calls"] += 1
        stats["running"] += 1
        stats["most"] = max(stats["most"], stats["running"])
        for _ in range(ticks_for(city)):
            await asyncio.sleep(0)
        stats["running"] -= 1
        return "forecast for " + city

    return load, stats


@test("returns the results in the order of the items")
async def _():
    # Earlier cities take longer, so they finish last.
    ticks = {"Leeds": 10, "York": 8, "Hull": 6, "Bath": 4, "Ely": 2}
    load, _stats = make_loader(lambda city: ticks[city])
    forecasts = await map_with_limit(["Leeds", "York", "Hull", "Bath", "Ely"], 2, load)
    assert forecasts == [
        "forecast for Leeds",
        "forecast for York",
        "forecast for Hull",
        "forecast for Bath",
        "forecast for Ely",
    ]


@test("never runs more than `limit` calls at once")
async def _():
    load, stats = make_loader()
    await map_with_limit(["a", "b", "c", "d", "e", "f", "g", "h"], 3, load)
    assert stats["most"] == 3
    assert stats["calls"] == 8


@test("starts the next call as soon as one finishes, not in batches")
async def _():
    # Leeds is slow. With a limit of 2, York, Hull and Bath all run beside it.
    order = []
    load, _stats = make_loader(lambda city: 30 if city == "Leeds" else 2)

    async def track(city, index):
        forecast = await load(city)
        order.append(city)
        return forecast

    await map_with_limit(["Leeds", "York", "Hull", "Bath"], 2, track)
    assert order == ["York", "Hull", "Bath", "Leeds"]


@test("passes the index as the second argument")
async def _():
    async def label(city, index):
        return f"{index + 1}. {city}"

    assert await map_with_limit(["Leeds", "York"], 2, label) == ["1. Leeds", "2. York"]


@test("returns an empty list for an empty list and calls nothing")
async def _():
    load, stats = make_loader()
    assert await map_with_limit([], 4, load) == []
    assert stats["calls"] == 0


@test("raises the error of a call that raises")
async def _():
    async def fetch(city, index):
        if city == "York":
            raise RuntimeError("York is offline")
        return city

    message = "did not raise"
    try:
        await map_with_limit(["Leeds", "York", "Hull"], 2, fetch)
    except RuntimeError as error:
        message = str(error)
    assert message == "York is offline"
