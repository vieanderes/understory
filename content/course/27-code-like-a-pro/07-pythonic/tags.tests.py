import logging

from solution import top_tags

POSTS = [
    {"title": "Soup", "tags": ["dinner", "quick", "vegan"]},
    {"title": "Toast", "tags": ["breakfast", "quick"]},
    {"title": "Stew", "tags": ["dinner", "slow"]},
    {"title": "Salad", "tags": ["quick", "vegan"]},
]


class Records(logging.Handler):
    def __init__(self):
        super().__init__()
        self.messages = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@test("returns the three most used tags with their counts")
def _():
    assert top_tags(POSTS) == [("quick", 3), ("dinner", 2), ("vegan", 2)]


@test("returns fewer than three when there are fewer tags")
def _():
    assert top_tags([{"title": "Tea", "tags": ["drink"]}]) == [("drink", 1)]


@test("prints nothing")
def _():
    before = len(printed())
    top_tags(POSTS)
    assert printed()[before:] == []


@test("logs how many tags it counted, at info level")
def _():
    root = logging.getLogger()
    handler = Records()
    root.addHandler(handler)
    root.setLevel(logging.INFO)
    try:
        top_tags(POSTS)
    finally:
        root.removeHandler(handler)
    assert "counted 5 tags" in handler.messages
