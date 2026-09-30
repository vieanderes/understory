import logging
from collections import Counter

logger = logging.getLogger(__name__)


def top_tags(posts):
    counts = Counter()
    for post in posts:
        for tag in post["tags"]:
            counts[tag] += 1
    logger.info("counted %d tags", len(counts))
    return counts.most_common(3)
