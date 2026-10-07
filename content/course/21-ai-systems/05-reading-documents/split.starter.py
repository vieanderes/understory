def split_batch(pages, auto=0.9, review=0.6):
    # Each page is a dict of label -> probability. Group pages into documents.
    # Return [{"type": ..., "pages": [1, 2], "route": "extract" or "review"}, ...]
    return [{"type": max(s, key=s.get), "pages": [n], "route": "extract"}
            for n, s in enumerate(pages, start=1)]
