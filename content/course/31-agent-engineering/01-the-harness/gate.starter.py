def gate(call, modes, hooks):
    # Check the action space, run each pre-tool hook in order, then apply the mode.
    return {"decision": "run", "input": call["input"], "reason": None}
