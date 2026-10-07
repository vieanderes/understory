import copy
import itertools

from solution import run_agent


class Crash(BaseException):
    """The process dies: a deploy, an out-of-memory kill."""


def scripted(*turns):
    # Like a real model, it makes up fresh call ids every time it's asked.
    ids = itertools.count(1)
    asked = []

    def model(history):
        asked.append(len(history))
        turn = sum(1 for m in history if m["role"] == "assistant")
        wanted = turns[turn] if turn < len(turns) else []
        calls = [{"id": f"toolu_{next(ids):02d}", "name": n, "input": a} for n, a in wanted]
        return {"calls": calls, "tokens": 100}

    model.asked = asked
    return model


class Publisher:
    # The show-notes service honours idempotency keys.
    def __init__(self):
        self.receipts = {}
        self.published = []

    def __call__(self, args, key):
        if key is not None and key in self.receipts:
            return self.receipts[key]
        self.published.append(args["episode"])
        self.receipts[key] = f"published {args['episode']}"
        return self.receipts[key]


def fresh():
    return {"history": [], "tokens": 0, "pending": []}


@test("a run ends with done when the model stops calling tools")
def _():
    pub = Publisher()
    state = fresh()
    status = run_agent(scripted([("publish", {"episode": 7})]), {"publish": pub}, state, 10_000, lambda s: None)
    assert status == "done"
    assert [m["role"] for m in state["history"]] == ["assistant", "tool", "assistant"]
    assert pub.published == [7]


@test("the budget is checked before each model call")
def _():
    forever = scripted(*[[("publish", {"episode": n})] for n in range(100)])
    status = run_agent(forever, {"publish": Publisher()}, fresh(), 250, lambda s: None)
    assert status == "budget"
    assert len(forever.asked) == 3, f"the model was asked {len(forever.asked)} times, not 3"


@test("calls are saved before they run")
def _():
    saves = []

    def publish(args, key):
        assert saves, "nothing was saved before the tool ran"
        assert [c["id"] for c in saves[-1]["pending"]] == [key], "the saved state didn't hold this call"
        return "published"

    run_agent(scripted([("publish", {"episode": 3})]), {"publish": publish}, fresh(), 10_000,
              lambda s: saves.append(copy.deepcopy(s)))


@test("a resumed run replays the saved calls instead of asking again")
def _():
    keys = []
    call = {"id": "toolu_07", "name": "publish", "input": {"episode": 12}}
    state = {"history": [{"role": "assistant", "calls": [call]}], "tokens": 100, "pending": [call]}
    model = scripted([("publish", {"episode": 12})])
    status = run_agent(model, {"publish": lambda a, k: keys.append(k) or "ok"}, state, 10_000, lambda s: None)
    assert status == "done"
    assert keys == ["toolu_07"], f"the tool got keys {keys}"
    assert model.asked == [2], "the model should only be asked after the replay"


@test("a crash mid-turn, then a resume, publishes once")
def _():
    pub = Publisher()
    crashed = []

    def publish_then_die(args, key):
        receipt = pub(args, key)
        if not crashed:
            crashed.append(True)
            raise Crash()  # the episode went out; the process died before saving
        return receipt

    model = scripted([("publish", {"episode": 41})])
    saved = {}
    try:
        run_agent(model, {"publish": publish_then_die}, fresh(), 10_000,
                  lambda s: saved.update(copy.deepcopy(s)))
    except Crash:
        pass
    status = run_agent(model, {"publish": publish_then_die}, copy.deepcopy(saved), 10_000, lambda s: None)
    assert status == "done"
    assert pub.published == [41], f"published {pub.published}"


@test("a failing tool becomes an error result and the run goes on")
def _():
    def publish(args, key):
        raise ValueError("episode 9 has no transcript")

    state = fresh()
    status = run_agent(scripted([("publish", {"episode": 9})]), {"publish": publish}, state, 10_000, lambda s: None)
    assert status == "done"
    assert state["history"][1]["result"] == "error: episode 9 has no transcript"
