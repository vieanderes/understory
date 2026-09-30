def build_request(system, history, question, keep):
    recent = history[-keep:] if keep > 0 else []
    # The first message must come from the user, so a cut that starts on a reply drops it.
    if recent and recent[0]["role"] == "assistant":
        recent = recent[1:]
    return {
        "system": system,
        "messages": recent + [{"role": "user", "content": question}],
    }
