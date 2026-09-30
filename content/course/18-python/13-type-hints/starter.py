from typing import Literal, TypedDict

Status = Literal["open", "closed"]


class Order(TypedDict):
    id: int
    status: Status
    total: float


def open_total(orders):
    # Your code here
    return 0.0
