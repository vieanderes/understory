import asyncio


async def map_with_limit(items, limit, fn):
    # This starts every call at once and ignores `limit`. Keep at most `limit` running.
    return list(await asyncio.gather(*(fn(item, index) for index, item in enumerate(items))))
