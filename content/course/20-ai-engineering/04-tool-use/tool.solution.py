def run_tool(block, tools):
    result = {"type": "tool_result", "tool_use_id": block["id"]}
    func = tools.get(block["name"])
    if func is None:
        return {**result, "content": f"Unknown tool: {block['name']}", "is_error": True}
    try:
        return {**result, "content": str(func(**block["input"]))}
    except Exception as error:
        # The model reads the error and can try again or tell the user.
        return {**result, "content": f"Error: {error}", "is_error": True}
