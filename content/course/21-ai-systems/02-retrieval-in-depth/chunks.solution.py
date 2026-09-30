def chunk_by_heading(title, markdown):
    chunks = []
    heading = None
    paragraph = []

    def flush():
        if paragraph:
            label = f"{title} > {heading}" if heading else title
            chunks.append(f"{label}: {' '.join(paragraph)}")
            paragraph.clear()

    for line in markdown.splitlines():
        line = line.strip()
        if line.startswith("## "):
            flush()
            heading = line[3:].strip()
        elif line == "":
            flush()
        else:
            paragraph.append(line)
    flush()
    return chunks
