import json
import logging

from solution import JsonFormatter


class Lines(logging.Handler):
    def __init__(self):
        super().__init__()
        self.lines = []

    def emit(self, record):
        self.lines.append(self.format(record))


def log(level, message, *args, **kwargs):
    logger = logging.getLogger("notes")
    logger.setLevel(logging.DEBUG)
    handler = Lines()
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)
    try:
        logger.log(level, message, *args, **kwargs)
    finally:
        logger.removeHandler(handler)
    return handler.lines[0]


@test("writes one line of JSON with the level and message")
def _():
    line = log(logging.INFO, "Note saved")
    assert json.loads(line) == {"level": "INFO", "message": "Note saved", "request_id": None}


@test("puts the request id from extra in its own field")
def _():
    line = log(logging.WARNING, "Slow save", extra={"request_id": "r-42"})
    assert json.loads(line) == {"level": "WARNING", "message": "Slow save", "request_id": "r-42"}


@test("fills in the %d placeholders of the message")
def _():
    line = log(logging.INFO, "Saved %d notes", 3, extra={"request_id": "r-7"})
    assert json.loads(line)["message"] == "Saved 3 notes"


@test("keeps each event on one line")
def _():
    assert "\n" not in log(logging.ERROR, "Save failed", extra={"request_id": "r-9"})
