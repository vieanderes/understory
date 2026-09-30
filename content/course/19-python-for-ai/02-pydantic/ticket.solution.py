from typing import Literal

from pydantic import BaseModel, ValidationError


class Ticket(BaseModel):
    category: Literal["refund", "delivery", "other"]
    urgent: bool


def read_ticket(reply_text):
    try:
        return Ticket.model_validate_json(reply_text)
    except ValidationError as error:
        # The log names every bad field, so a wrong prompt is quick to spot.
        print(error)
        return None
