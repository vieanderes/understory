def plan_actions(tool_calls, policy):
    plan = {"run": [], "confirm": [], "refuse": []}
    for call in tool_calls:
        # A tool the policy doesn't name is refused: new tools start locked.
        rule = policy.get(call["name"], "refuse")
        if rule == "auto":
            plan["run"].append(call["id"])
        elif rule == "confirm":
            plan["confirm"].append(call["id"])
        else:
            plan["refuse"].append(call["id"])
    return plan
