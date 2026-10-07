import asyncio


async def fan_out(tasks, worker, max_workers, budget):
    if max_workers < 1:
        raise ValueError("max_workers must be at least 1")

    # Admission is decided up front from the estimates, so it never depends on timing.
    admitted, skipped, committed = [], [], 0
    for task in tasks:
        if committed + task["estimate"] <= budget:
            admitted.append(task)
            committed += task["estimate"]
        else:
            skipped.append(task["id"])

    gate = asyncio.Semaphore(max_workers)

    async def run(task):
        async with gate:
            try:
                return task, await worker(task), None
            except Exception as exc:  # one worker failing must not sink the others
                return task, None, exc

    outcomes = await asyncio.gather(*(run(task) for task in admitted))

    results, failed, tokens = [], [], 0
    for task, reply, error in outcomes:  # gather keeps input order
        if error is None:
            results.append({"id": task["id"], "result": reply["result"]})
            tokens += reply["tokens"]
        else:
            failed.append(task["id"])
    return {"results": results, "failed": failed, "skipped": skipped, "tokens": tokens}
