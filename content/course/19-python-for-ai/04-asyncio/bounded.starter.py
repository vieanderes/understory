import asyncio


async def classify_all(reviews, classify, limit):
    # Your code here: this awaits one call at a time.
    labels = []
    for review in reviews:
        labels.append(await classify(review))
    return labels
