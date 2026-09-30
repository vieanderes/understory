from solution import build_request


@test("uses the small model and one user message by default")
def _():
    expect(build_request("Hi")).to_equal(
        {"model": "small", "messages": [{"role": "user", "content": "Hi"}]}
    )


@test("takes the model by name")
def _():
    expect(build_request("Hi", model="large")["model"]).to_equal("large")


@test("passes every extra option through")
def _():
    request = build_request("Hi", temperature=0.2, max_tokens=50)
    expect(request["temperature"]).to_equal(0.2)
    expect(request["max_tokens"]).to_equal(50)


@test("two requests never share a messages list")
def _():
    first = build_request("One")
    second = build_request("Two")
    first["messages"].append({"role": "assistant", "content": "Sure"})
    expect(second["messages"]).to_have_length(1)
