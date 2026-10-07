def run_agent(model, tools, state, max_tokens, save):
    # A naive loop: no budget, no checkpoint, no resume, no keys.
    for _ in range(50):
        reply = model(state["history"])
        state["history"].append({"role": "assistant", "calls": reply["calls"]})
        if not reply["calls"]:
            return "done"
        for call in reply["calls"]:
            result = tools[call["name"]](call["input"], None)
            state["history"].append({"role": "tool", "id": call["id"], "result": result})
    return "steps"
