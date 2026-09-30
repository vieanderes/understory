import difflib


def find_book(catalogue, title):
    # Return a tool result the model can act on, found or not.
    for book_id, name in catalogue.items():
        if name == title:
            return {"content": [{"type": "text", "text": book_id}], "isError": False}
    return {"content": [], "isError": False}
