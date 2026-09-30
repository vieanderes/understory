from typing import TypedDict


class Result(TypedDict):
    id: str
    category: str
    passed: bool


def report(results: list[Result]) -> list[str]:
    # Your code here
    return []
