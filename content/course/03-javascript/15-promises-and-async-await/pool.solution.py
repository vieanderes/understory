import asyncio


async def map_with_limit(items, limit, fn):
    # The semaphore holds `limit` passes. A call waits for a free one, and hands it on
    # when it finishes, so the next call starts at once.
    gate = asyncio.Semaphore(limit)

    async def one(item, index):
        async with gate:
            return await fn(item, index)

    # gather keeps the order of the items, and raises the first error a call raises.
    return list(await asyncio.gather(*(one(item, index) for index, item in enumerate(items))))
