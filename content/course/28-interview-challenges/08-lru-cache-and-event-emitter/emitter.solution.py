from collections.abc import Callable
from dataclasses import dataclass

Listener = Callable[..., None]


# eq=False compares entries by identity: removing one never touches another registration
# that happens to hold the same function.
@dataclass(eq=False)
class _Entry:
    fn: Listener
    once: bool


class Emitter:
    def __init__(self):
        self._listeners: dict[str, list[_Entry]] = {}

    def on(self, event: str, fn: Listener) -> Callable[[], None]:
        return self._add(event, _Entry(fn, once=False))

    def once(self, event: str, fn: Listener) -> Callable[[], None]:
        return self._add(event, _Entry(fn, once=True))

    def off(self, event: str, fn: Listener) -> None:
        entries = self._listeners.get(event, [])
        for entry in entries:
            if entry.fn is fn:
                entries.remove(entry)
                return

    def emit(self, event: str, *args) -> bool:
        entries = self._listeners.get(event, [])
        if not entries:
            return False
        # A copy: listeners that remove or add others mid-emit can't make the loop skip one.
        for entry in list(entries):
            if entry.once:
                self._remove(event, entry)
            entry.fn(*args)
        return True

    def _add(self, event: str, entry: _Entry) -> Callable[[], None]:
        self._listeners.setdefault(event, []).append(entry)
        return lambda: self._remove(event, entry)

    def _remove(self, event: str, entry: _Entry) -> None:
        entries = self._listeners.get(event, [])
        if entry in entries:
            entries.remove(entry)
