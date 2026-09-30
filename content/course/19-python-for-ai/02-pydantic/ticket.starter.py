from typing import Literal

from pydantic import BaseModel, ValidationError


class Ticket(BaseModel):
    category: Literal["refund", "delivery", "other"]
    urgent: bool


def read_ticket(reply_text):
    # Your code here: a bad reply should give None, not an error.
    return Ticket.model_validate_json(reply_text)
