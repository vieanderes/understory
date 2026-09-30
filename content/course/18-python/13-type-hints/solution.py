from typing import Literal, TypedDict

Status = Literal["open", "closed"]


class Order(TypedDict):
    id: int
    status: Status
    total: float


def open_total(orders: list[Order]) -> float:
    total = 0.0
    for order in orders:
        if order["status"] == "open":
            total = total + order["total"]
    return total
