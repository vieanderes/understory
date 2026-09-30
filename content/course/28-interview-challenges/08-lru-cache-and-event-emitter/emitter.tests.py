from solution import Emitter


@test("emit passes the arguments and reports a listener ran")
def _():
    emitter = Emitter()
    seen = []
    emitter.on("saved", lambda id, title: seen.extend([id, title]))
    assert emitter.emit("saved", 7, "Notes") is True
    assert seen == [7, "Notes"]


@test("an event nobody listens to returns False")
def _():
    emitter = Emitter()
    assert emitter.emit("saved") is False
    stop = emitter.on("saved", lambda: None)
    stop()
    assert emitter.emit("saved") is False


@test("listeners run in the order they were added")
def _():
    emitter = Emitter()
    order = []
    emitter.on("saved", lambda: order.append("toast"))
    emitter.on("saved", lambda: order.append("badge"))
    emitter.emit("saved")
    assert order == ["toast", "badge"]


@test("the function returned by on unsubscribes, and calling it twice is harmless")
def _():
    emitter = Emitter()
    calls = []
    stop = emitter.on("saved", lambda: calls.append("gone"))
    emitter.on("saved", lambda: calls.append("keep"))
    stop()
    stop()
    emitter.emit("saved")
    assert calls == ["keep"]


@test("off removes a listener, and an unknown one changes nothing")
def _():
    emitter = Emitter()
    calls = []

    def toast():
        calls.append("toast")

    emitter.on("saved", toast)
    emitter.on("saved", lambda: calls.append("badge"))
    emitter.off("saved", lambda: None)
    emitter.off("saved", toast)
    emitter.emit("saved")
    assert calls == ["badge"]


@test("once runs a single time")
def _():
    emitter = Emitter()
    calls = []
    emitter.once("saved", lambda: calls.append("welcome"))
    emitter.emit("saved")
    emitter.emit("saved")
    assert len(calls) == 1


@test("off removes a once listener before it runs")
def _():
    emitter = Emitter()
    calls = []

    def welcome():
        calls.append("welcome")

    emitter.once("saved", welcome)
    emitter.off("saved", welcome)
    assert emitter.emit("saved") is False
    assert calls == []


@test("a listener that removes itself does not make the next one skip")
def _():
    emitter = Emitter()
    calls = []

    def toast():
        emitter.off("saved", toast)
        calls.append("toast")

    emitter.on("saved", toast)
    emitter.on("saved", lambda: calls.append("badge"))
    emitter.emit("saved")
    emitter.emit("saved")
    assert calls == ["toast", "badge", "badge"]


@test("once followed by on does not skip the second listener")
def _():
    emitter = Emitter()
    calls = []
    emitter.once("saved", lambda: calls.append("first"))
    emitter.on("saved", lambda: calls.append("second"))
    emitter.emit("saved")
    assert calls == ["first", "second"]


@test("events are kept apart")
def _():
    emitter = Emitter()
    calls = []
    emitter.on("saved", lambda: calls.append("saved"))
    emitter.on("deleted", lambda: calls.append("deleted"))
    emitter.emit("deleted")
    assert calls == ["deleted"]
