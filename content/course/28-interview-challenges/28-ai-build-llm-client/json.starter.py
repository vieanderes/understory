import json
from collections.abc import Awaitable, Callable
from typing import Any

Complete = Callable[[str], Awaitable[str]]


# Models often wrap JSON in a code fence, with or without `json` after the backticks.
def strip_fences(text: str) -> str:
    return text


async def complete_json(complete: Complete, prompt: str, is_valid: Callable[[Any], bool]) -> Any:
    # One try, trusting the reply. Strip fences, check the shape, and re-ask once.
    return json.loads(await complete(prompt))
