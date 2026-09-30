def longest_unique(songs):
    in_window = set()
    left = 0
    best = 0
    for right, song in enumerate(songs):
        # Shrink from the left until the new song no longer repeats.
        while song in in_window:
            in_window.remove(songs[left])
            left += 1
        in_window.add(song)
        best = max(best, right - left + 1)
    return best
