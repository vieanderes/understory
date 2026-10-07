from solution import route_request

SMALL = {"name": "small", "cost": 0.001, "dpa": True,
         "quality": {"classify": 0.93, "draft": 0.80}}
LARGE = {"name": "large", "cost": 0.02, "dpa": True,
         "quality": {"classify": 0.98, "draft": 0.96}}
TRIAL = {"name": "trial", "cost": 0.0005, "dpa": False,
         "quality": {"classify": 0.94}}
MODELS = [LARGE, SMALL, TRIAL]


def req(task="classify", risk="low", personal_data=False):
    return {"task": task, "risk": risk, "personal_data": personal_data}


@test("low risk takes the cheapest model that is good enough")
def _():
    assert route_request(req(), MODELS, 1.0) == "trial"


@test("personal data only goes to models with a DPA")
def _():
    assert route_request(req(personal_data=True), MODELS, 1.0) == "small"


@test("high risk raises the bar to the stronger model")
def _():
    assert route_request(req(risk="high"), MODELS, 1.0) == "large"


@test("a task a model was never measured on doesn't count")
def _():
    assert route_request(req(task="summarise"), MODELS, 1.0) == "defer"
    assert route_request(req(task="draft", risk="high"), [SMALL, TRIAL], 1.0) == "human"


@test("an empty budget sends high risk to a person and defers the rest")
def _():
    assert route_request(req(risk="high"), MODELS, 0.01) == "human"
    assert route_request(req(task="draft"), MODELS, 0.01) == "defer"


@test("on equal cost the better-measured model wins")
def _():
    twin = {**SMALL, "name": "small-tuned", "quality": {"classify": 0.97}}
    assert route_request(req(personal_data=True), [SMALL, twin], 1.0) == "small-tuned"


@test("an unknown risk level raises ValueError")
def _():
    expect(lambda: route_request(req(risk="medium"), MODELS, 1.0)).to_raise(ValueError)
