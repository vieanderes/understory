"""Three online-assessment tasks. Replace each body; keep the signatures."""


def smallest_missing_positive(a: list[int]) -> int:
    """Return the smallest positive integer (greater than 0) that does not occur in a.

    N is 1..100,000. Each element is -1,000,000..1,000,000.
    Expected worst-case time: O(N).
    """
    raise NotImplementedError


def max_slice_sum(a: list[int]) -> int:
    """Return the largest sum of any non-empty contiguous slice of a.

    N is 1..1,000,000. Each element is -1,000,000..1,000,000.
    Expected worst-case time: O(N). Extra space: O(1).
    """
    raise NotImplementedError


def is_properly_nested(s: str) -> bool:
    """Return True when every (, [ and { in s is closed in the right order.

    s has length 0..200,000 and contains only the six bracket characters.
    Expected worst-case time: O(N).
    """
    raise NotImplementedError
