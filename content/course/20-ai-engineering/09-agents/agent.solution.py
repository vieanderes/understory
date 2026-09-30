def run_agent(call_model, tools, messages, max_steps=8):
    for step in range(max_steps):
        reply = call_model(messages)
        # Keep the whole reply, tool_use blocks included: the results must follow them.
        messages.append({"role": "assistant", "content": reply["content"]})
        if reply["stop_reason"] != "tool_use":
            return "".join(b["text"] for b in reply["content"] if b["type"] == "text")
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
