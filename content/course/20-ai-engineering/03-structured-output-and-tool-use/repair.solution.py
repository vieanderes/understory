def ask_json(client, prompt, validate, attempts=2):
    messages = [{"role": "user", "content": prompt}]
    for attempt in range(attempts):
        reply = client.messages.create(model="claude-opus-5-5", max_tokens=1024, messages=messages)
        text = "".join(block.text for block in reply.content if block.type == "text")
        try:
            return validate(text)
        except ValueError as error:
            # Show the model its own reply and what was wrong with it.
            messages = messages + [
                {"role": "assistant", "content": text},
                {"role": "user", "content": f"That reply was invalid: {error}. Reply with only the JSON."},
            ]
    raise ValueError(f"No valid reply after {attempts} attempts")
