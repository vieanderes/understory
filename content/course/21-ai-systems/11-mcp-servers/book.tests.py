from solution import find_book

BOOKS = {"b1": "Dune", "b2": "Emma", "b3": "Middlemarch", "b4": "Dune Messiah"}


def text_of(result):
    return result["content"][0]["text"]


@test("an exact title returns its id")
def _():
    assert find_book(BOOKS, "Emma") == {"content": [{"type": "text", "text": "b2"}], "isError": False}


@test("case and outer spaces don't matter")
def _():
    assert text_of(find_book(BOOKS, "  middlemarch ")) == "b3"


@test("a near miss is an error that suggests close titles")
def _():
    result = find_book(BOOKS, "Middlemarsh")
    assert result["isError"] is True
    assert text_of(result) == 'No book called "Middlemarsh". Did you mean: Middlemarch?'


@test("with nothing close, the error says what to do next")
def _():
    result = find_book(BOOKS, "Ulysses")
    assert result["isError"] is True
    assert text_of(result) == 'No book called "Ulysses". Check the spelling, or ask the user.'


@test("an empty title is an error, not a crash")
def _():
    result = find_book(BOOKS, "   ")
    assert result["isError"] is True
    assert text_of(result) == "Give a title to search for."
