def split_batch(pages, auto=0.9, review=0.6):
    if review > auto:
        raise ValueError("review must not be above auto")
    docs = []
    for number, scores in enumerate(pages, start=1):
        label = max(scores, key=scores.get)
        p = scores[label]
        if p < review:
            # Too unsure to name the page, or to say it continues anything.
            docs.append({"type": "unknown", "pages": [number], "route": "review"})
        elif label == "continuation" and docs:
            docs[-1]["pages"].append(number)
            if p < auto:
                docs[-1]["route"] = "review"
        elif label == "continuation":
            # A batch can't start halfway through a document.
            docs.append({"type": "unknown", "pages": [number], "route": "review"})
        else:
            route = "extract" if p >= auto else "review"
            docs.append({"type": label, "pages": [number], "route": route})
    return docs
