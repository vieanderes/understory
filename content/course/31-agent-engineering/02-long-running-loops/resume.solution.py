def run_agent(model, tools, state, max_tokens, save):
    while True:
        # Calls saved before a crash run first, with their original ids as keys.
        if state["pending"]:
            for call in state["pending"]:
                try:
                    result = tools[call["name"]](call["input"], call["id"])
                except Exception as exc:  # the model reads it and can correct itself
                    result = f"error: {exc}"
                state["history"].append({"role": "tool", "id": call["id"], "result": result})
            state["pending"] = []
            save(state)

        if state["tokens"] >= max_tokens:
            return "budget"

        reply = model(state["history"])
        state["tokens"] += reply["tokens"]
        state["history"].append({"role": "assistant", "calls": reply["calls"]})
        if not reply["calls"]:
            save(state)
            return "done"
        state["pending"] = list(reply["calls"])
        save(state)  # write-ahead: the calls are on disk before any of them runs
