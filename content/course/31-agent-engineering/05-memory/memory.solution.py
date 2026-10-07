TRUSTED = {"user", "verified_tool"}


def same(a, b):
    return a.strip().lower() == b.strip().lower()


class MemoryStore:
    def __init__(self):
        self.entries = {}  # (tenant, user, key) -> one fact

    def write(self, scope, key, value, source, day, ttl=None):
        if source not in TRUSTED:
            return "rejected"  # text from a page or an email never becomes a memory
        slot = (*scope, key)
        old = self.entries.get(slot)
        self.entries[slot] = {"value": value, "source": source, "day": day, "ttl": ttl}
        if old is None:
            return "added"
        return "duplicate" if same(old["value"], value) else "updated"

    def recall(self, scope, today, stale_after=90):
        found = []
        for slot, entry in sorted(self.entries.items()):
            if slot[:-1] != tuple(scope):
                continue
            if entry["ttl"] is not None and today - entry["day"] > entry["ttl"]:
                del self.entries[slot]  # expired: forget it
                continue
            found.append({"key": slot[-1], "value": entry["value"], "day": entry["day"],
                          "verify": today - entry["day"] > stale_after})
        return found
