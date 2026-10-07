import asyncio

from solution import fan_out


def make_worker(delays=None, fail=()):
    seen = {"running": 0, "peak": 0, "started": []}

    async def worker(task):
        seen["running"] += 1
        seen["peak"] = max(seen["peak"], seen["running"])
        seen["started"].append(task["id"])
        await asyncio.sleep((delays or {}).get(task["id"], 0.01))
        seen["running"] -= 1
        if task["id"] in fail:
            raise RuntimeError("worker crashed")
        return {"tokens": task["estimate"], "result": f"checked {task['id']}"}

    return worker, seen


def year(n, estimate=1000):
    return {"id": f"year-{n}", "estimate": estimate}


@test("never runs more workers at once than the cap")
async def _():
    worker, seen = make_worker()
    await fan_out([year(n) for n in range(7, 14)], worker, 2, 100_000)
    assert seen["peak"] == 2, f"{seen['peak']} workers ran at once"


@test("merges results in task order, not finishing order")
async def _():
    worker, _ = make_worker(delays={"year-7": 0.05, "year-8": 0.01, "year-9": 0.03})
    got = await fan_out([year(7), year(8), year(9)], worker, 3, 100_000)
    assert [r["id"] for r in got["results"]] == ["year-7", "year-8", "year-9"]
    assert got["tokens"] == 3000


@test("skips a task whose estimate would break the budget, and never starts it")
async def _():
    worker, seen = make_worker()
    got = await fan_out([year(7, 4000), year(8, 5000), year(9, 3000)], worker, 2, 8000)
    assert got["skipped"] == ["year-8"]
    assert "year-8" not in seen["started"]


@test("a later, smaller task still fits after a skip")
async def _():
    worker, _ = make_worker()
    got = await fan_out([year(7, 6000), year(8, 5000), year(9, 2000)], worker, 2, 8000)
    assert [r["id"] for r in got["results"]] == ["year-7", "year-9"]


@test("one failing worker is reported and the others still return")
async def _():
    worker, _ = make_worker(fail={"year-8"})
    got = await fan_out([year(7), year(8), year(9)], worker, 3, 100_000)
    assert got["failed"] == ["year-8"]
    assert [r["id"] for r in got["results"]] == ["year-7", "year-9"]
    assert got["tokens"] == 2000


@test("a cap below 1 raises ValueError")
async def _():
    worker, _ = make_worker()
    try:
        await fan_out([year(7)], worker, 0, 1000)
    except ValueError:
        return
    assert False, "expected ValueError"
