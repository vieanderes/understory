# How each final stop reason is reported. A cut-off or a refusal is not an answer.
OUTCOMES = {"end_turn": "answer", "stop_sequence": "answer",
            "max_tokens": "incomplete", "refusal": "refused"}


def run_agent(call_model, tools, messages, max_steps=8):
    for step in range(max_steps):
        reply = call_model(messages)
        # Keep the whole reply, tool_use blocks included: the results must follow them.
        messages.append({"role": "assistant", "content": reply["content"]})
        stop = reply["stop_reason"]
        if stop == "pause_turn":
            # The server paused a long turn. Sending the history back as it is resumes it.
            continue
        if stop != "tool_use":
            text = "".join(b["text"] for b in reply["content"] if b["type"] == "text")
            return OUTCOMES[stop], text
        results = []
        for block in reply["content"]:
            if block["type"] != "tool_use":
                continue
            result = {"type": "tool_result", "tool_use_id": block["id"]}
            try:
                result["content"] = str(tools[block["name"]](**block["input"]))
            except Exception as error:
                result["content"] = f"Error: {error}"
                result["is_error"] = True
            results.append(result)
        messages.append({"role": "user", "content": results})
    raise RuntimeError(f"No answer after {max_steps} steps")
