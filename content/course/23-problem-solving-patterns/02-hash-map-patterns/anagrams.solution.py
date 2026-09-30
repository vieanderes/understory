# Anagrams share their sorted letters, so that is the key. A dict keeps keys in the order
# they were first added, which is the order the groups must come out in.
def group_anagrams(words):
    groups = {}
    for word in words:
        key = "".join(sorted(word))
        groups.setdefault(key, []).append(word)
    return list(groups.values())
