import logging
from collections import Counter

logger = logging.getLogger(__name__)


def top_tags(posts):
    counts = {}
    for i in range(len(posts)):
        tags = posts[i]["tags"]
        for j in range(len(tags)):
            tag = tags[j]
            if tag in counts:
                counts[tag] = counts[tag] + 1
            else:
                counts[tag] = 1
    print("counted", len(counts), "tags")
    pairs = []
    for tag in counts:
        pairs.append((tag, counts[tag]))
    pairs.sort(key=lambda pair: pair[1], reverse=True)
    return pairs[:3]
