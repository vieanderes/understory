import asyncio


async def classify_all(reviews, classify, limit):
    # One semaphore for the whole job, so every call shares the same slots.
    slots = asyncio.Semaphore(limit)

    async def one(review):
        async with slots:
            return await classify(review)

    return await asyncio.gather(*(one(r) for r in reviews))
