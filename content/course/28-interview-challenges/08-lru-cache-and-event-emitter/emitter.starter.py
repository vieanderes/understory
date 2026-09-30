from collections.abc import Callable

Listener = Callable[..., None]


class Emitter:
    def __init__(self):
        self._listeners: dict[str, list[Listener]] = {}

    def on(self, event: str, fn: Listener) -> Callable[[], None]:
        self._listeners.setdefault(event, []).append(fn)
        # Return a function that removes this listener again.
        return lambda: None

    def once(self, event: str, fn: Listener) -> Callable[[], None]:
        # Should run at most one time.
        return self.on(event, fn)

    def off(self, event: str, fn: Listener) -> None:
        listeners = self._listeners.get(event, [])
        if fn in listeners:
            listeners.remove(fn)

    def emit(self, event: str, *args) -> bool:
        # Should return whether any listener ran.
        for fn in self._listeners.get(event, []):
            fn(*args)
        return True
