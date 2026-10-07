TRUSTED = {"user", "verified_tool"}


class MemoryStore:
    def __init__(self):
        self.entries = []

    def write(self, scope, key, value, source, day, ttl=None):
        # Add write policies: reject untrusted sources, dedupe, update, one fact per key.
        self.entries.append({"key": key, "value": value, "day": day})
        return "added"

    def recall(self, scope, today, stale_after=90):
        # Add scoping, forgetting and the verify flag.
        return [{**e, "verify": False} for e in self.entries]
