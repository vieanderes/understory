def distinct_magnitudes(A: list[int]) -> int:
    # Correct, but `in` on a list scans it, so this is O(N * D) for D different magnitudes.
    seen: list[int] = []
    for value in A:
        magnitude = abs(value)
        if magnitude not in seen:
            seen.append(magnitude)
    return len(seen)
