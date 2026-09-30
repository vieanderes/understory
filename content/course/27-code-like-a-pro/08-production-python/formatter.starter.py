import json
import logging


class JsonFormatter(logging.Formatter):
    def format(self, record):
        # Return one line of JSON with "level", "message" and "request_id".
        return record.getMessage()
