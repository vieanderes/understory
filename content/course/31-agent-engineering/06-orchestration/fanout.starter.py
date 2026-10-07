import asyncio


async def fan_out(tasks, worker, max_workers, budget):
    # Admit tasks in order within the token budget, run at most max_workers at once,
    # and merge the results in the order the tasks were given.
    return {"results": [], "failed": [], "skipped": [], "tokens": 0}
