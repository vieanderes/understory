from solution import complete_json, strip_fences


def is_review(value):
    return (
        isinstance(value, dict)
        and isinstance(value.get("stars"), (int, float))
        and not isinstance(value.get("stars"), bool)
        and isinstance(value.get("summary"), str)
    )


def scripted(replies):
    """A fake model that gives the scripted replies in turn, and records each prompt."""
    prompts = []

    async def complete(prompt):
        prompts.append(prompt)
        return replies[len(prompts) - 1] if len(prompts) <= len(replies) else "no more replies"

    return complete, prompts


PROMPT = 'Rate this review as JSON: "Fast delivery, box was crushed."'


@test("strip_fences removes a fence with or without a language")
def _():
    assert strip_fences('```json\n{"stars": 3}\n```') == '{"stars": 3}'
    assert strip_fences("  ```\n[1, 2]\n```  ") == "[1, 2]"
    assert strip_fences('{"stars": 3}') == '{"stars": 3}'


@test("a fenced reply is parsed and checked on the first try")
async def _():
    complete, prompts = scripted(['```json\n{"stars": 3, "summary": "Quick but damaged"}\n```'])
    assert await complete_json(complete, PROMPT, is_review) == {"stars": 3, "summary": "Quick but damaged"}
    assert prompts == [PROMPT]


@test("broken JSON gets one re-ask that says what was wrong")
async def _():
    complete, prompts = scripted(["Sure. {stars: 3}", '{"stars": 3, "summary": "Quick but damaged"}'])
    assert await complete_json(complete, PROMPT, is_review) == {"stars": 3, "summary": "Quick but damaged"}
    assert len(prompts) == 2
    assert PROMPT in prompts[1]
    assert "not valid JSON" in prompts[1]


@test("valid JSON of the wrong shape is re-asked too")
async def _():
    complete, prompts = scripted(['{"rating": "3/5"}', '{"stars": 3, "summary": "Quick but damaged"}'])
    assert await complete_json(complete, PROMPT, is_review) == {"stars": 3, "summary": "Quick but damaged"}
    assert "wrong shape" in prompts[1]


@test("two bad replies raise, and there is no third call")
async def _():
    complete, prompts = scripted(['{"rating": "3/5"}', "I cannot rate this.", '{"stars": 3, "summary": "late"}'])
    message = ""
    try:
        await complete_json(complete, PROMPT, is_review)
    except Exception as error:
        message = str(error)
    assert "not valid JSON" in message
    assert len(prompts) == 2
