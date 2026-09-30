import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

# Messages, replies and tool calls are plain dicts, the shape model APIs send as JSON:
#   reply:   {"type": "tool_calls", "calls": [{"id", "name", "input"}]}
#            {"type": "final", "text": "..."}
#   message: {"role": "user", "content": "..."}
#            {"role": "assistant", "reply": reply}
#            {"role": "tool", "call_id": "...", "content": "...", "is_error": bool}
Model = Callable[[list[dict]], Awaitable[dict]]


@dataclass
class Tool:
    run: Callable[[Any], Awaitable[str]]
    write: bool = False


@dataclass
class Options:
    task: str
    max_steps: int
    max_retries: int
    approve: Callable[[dict], Awaitable[bool]]
    fallback: dict  # {"answer": str, "sources": list[str]}


@dataclass
class Result:
    status: str  # "done", "fallback" or "stopped"
    output: dict
    steps: int


def check(text: str) -> dict | str:
    """Returns an error message the model can act on, or the parsed output."""
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return "not valid JSON"
    if not isinstance(data, dict):
        return "expected a JSON object"
    answer, sources = data.get("answer"), data.get("sources")
    if not isinstance(answer, str):
        return "answer must be a string"
    if not isinstance(sources, list) or not all(isinstance(s, str) for s in sources):
        return "sources must be a list of strings"
    return {"answer": answer, "sources": sources}


async def run_call(call: dict, tools: dict[str, Tool], approve) -> tuple[str, bool]:
    tool = tools.get(call["name"])
    if tool is None:
        return f"Unknown tool: {call['name']}", True
    if tool.write and not await approve(call):
        return "Not approved by the user", True
    try:
        return await tool.run(call["input"]), False
    except Exception as error:
        # An error goes back as a result: the model can often recover, a crash cannot.
        return f"Error: {error}", True


async def run_agent(model: Model, tools: dict[str, Tool], options: Options) -> Result:
    messages: list[dict] = [{"role": "user", "content": options.task}]
    retries = 0
    for step in range(1, options.max_steps + 1):
        reply = await model(messages)
        messages.append({"role": "assistant", "reply": reply})
        if reply["type"] == "final":
            checked = check(reply["text"])
            if not isinstance(checked, str):
                return Result("done", checked, step)
            retries += 1
            if retries > options.max_retries:
                return Result("fallback", options.fallback, step)
            messages.append({
                "role": "user",
                "content": f'Invalid output: {checked}. Reply with JSON {{"answer": string, "sources": string[]}}.',
            })
            continue
        for call in reply["calls"]:
            content, is_error = await run_call(call, tools, options.approve)
            # Tool text stays a tool message: data for the model to read, never new instructions.
            messages.append({"role": "tool", "call_id": call["id"], "content": content, "is_error": is_error})
    return Result("stopped", options.fallback, options.max_steps)
