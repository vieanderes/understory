from typing import TypedDict


class Result(TypedDict):
    id: str
    category: str
    passed: bool


def report(results: list[Result]) -> list[str]:
    if not results:
        return ["No results"]
    cases: dict[str, int] = {}
    passes: dict[str, int] = {}
    for r in results:
        c = r["category"]
        cases[c] = cases.get(c, 0) + 1
        passes[c] = passes.get(c, 0) + (1 if r["passed"] else 0)
    total = sum(1 for r in results if r["passed"])
    weakest = min(cases, key=lambda c: passes[c] / cases[c])
    return [
        f"{total} of {len(results)} passed",
        f"Weakest: {weakest}, {passes[weakest]} of {cases[weakest]} passed",
    ]
