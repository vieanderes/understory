def clean_tags(text):
    tags = []
    for part in text.split(","):
        tag = part.strip().lower()
        if tag:
            tags.append(tag)
    return tags
