"""Reference solutions. Each is the O(N) answer an online-assessment performance test expects."""


def smallest_missing_positive(a: list[int]) -> int:
    # The answer is at most len(a) + 1, so only values in 1..len(a) matter.
    # A set is O(N) space; the in-place index-marking trick is O(1) extra but mutates a.
    seen = {x for x in a if 0 < x <= len(a)}
    candidate = 1
    while candidate in seen:
        candidate += 1
    return candidate


def max_slice_sum(a: list[int]) -> int:
    # Kadane: the best slice ending here either extends the best one ending at the previous
    # element or starts fresh. Seeding with a[0] keeps the all-negative case right.
    best = ending_here = a[0]
    for x in a[1:]:
        ending_here = max(x, ending_here + x)
        best = max(best, ending_here)
    return best


PAIRS = {")": "(", "]": "[", "}": "{"}


def is_properly_nested(s: str) -> bool:
    stack: list[str] = []
    for ch in s:
        if ch in PAIRS:
            if not stack or stack.pop() != PAIRS[ch]:
                return False
        else:
            stack.append(ch)
    return not stack
