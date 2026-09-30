import json
import re
from collections.abc import Awaitable, Callable
from typing import Any

Complete = Callable[[str], Awaitable[str]]


# Models often wrap JSON in a code fence, with or without `json` after the backticks.
def strip_fences(text: str) -> str:
    text = re.sub(r"^```(?:json)?\s*", "", text.strip(), flags=re.IGNORECASE)
    return re.sub(r"\s*```$", "", text).strip()


async def complete_json(complete: Complete, prompt: str, is_valid: Callable[[Any], bool]) -> Any:
    problem = ""
    for attempt in range(2):
        # The re-ask says what was wrong, which is usually enough for the model to fix it.
        text = prompt if attempt == 0 else f"{prompt}\n\nYour last reply was invalid: {problem}. Reply with JSON only."
        reply = await complete(text)
        try:
            value = json.loads(strip_fences(reply))
        except json.JSONDecodeError:
            problem = "not valid JSON"
            continue
        if is_valid(value):
            return value
        problem = "wrong shape"
    raise ValueError(f"No valid JSON after one re-ask: {problem}")
