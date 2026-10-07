def decide(call, tools, run):
    tool = tools.get(call["name"])
    if tool is None:
        return {"decision": "deny", "reason": "unknown tool"}

    sends_out = tool["sends_out"]
    private = run["sensitivity"] in ("personal", "secret")
    untrusted = run["untrusted"]

    # Denials first: no approval can make these safe.
    if sends_out and run["sensitivity"] == "secret":
        return {"decision": "deny", "reason": "secret data could leave"}
    if sends_out and private and untrusted:
        return {"decision": "deny", "reason": "lethal trifecta"}

    if tool["effect"] == "irreversible":
        return {"decision": "ask", "reason": "irreversible"}
    if sends_out and (private or untrusted):
        return {"decision": "ask", "reason": "data could leave"}
    if tool["effect"] == "write" and untrusted:
        return {"decision": "ask", "reason": "untrusted content in context"}
    return {"decision": "allow", "reason": "ok"}
