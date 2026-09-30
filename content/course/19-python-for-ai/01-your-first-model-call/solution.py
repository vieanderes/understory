MODEL = "claude-opus-5"


def ask(client, question):
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": question}],
    )
    # A reply is a list of blocks, and only text blocks carry text.
    return "".join(block.text for block in response.content if block.type == "text")
