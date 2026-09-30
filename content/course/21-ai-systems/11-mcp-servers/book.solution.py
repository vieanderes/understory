import difflib


def result(text, is_error=False):
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def find_book(catalogue, title):
    if not title.strip():
        return result("Give a title to search for.", is_error=True)
    for book_id, name in catalogue.items():
        if name.lower() == title.strip().lower():
            return result(book_id)
    # The message is for the model: say what went wrong and what to try next.
    close = difflib.get_close_matches(title, list(catalogue.values()), n=3, cutoff=0.6)
    hint = f" Did you mean: {', '.join(close)}?" if close else " Check the spelling, or ask the user."
    return result(f'No book called "{title}".' + hint, is_error=True)
