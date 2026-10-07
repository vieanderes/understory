def gate(call, modes, hooks):
    name = call["name"]
    if name not in modes:
        reason = f"{name} is not in the action space"
        return {"decision": "block", "input": call["input"], "reason": reason}

    current = {"name": name, "input": dict(call["input"])}
    for hook in hooks:
        verdict = hook(current)
        if verdict is None:
            continue  # no objection: the next hook still gets its say
        action, detail = verdict
        if action == "block":
            return {"decision": "block", "input": current["input"], "reason": detail}
        if action == "rewrite":
            current = {"name": name, "input": dict(detail)}

    decision = "run" if modes[name] == "allow" else "ask"
    return {"decision": decision, "input": current["input"], "reason": None}
