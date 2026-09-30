"""Loads src/katas.py, or solution/katas.py when KATA_TARGET=solution.

The tests import from here, so the same tests run against your code or the reference.
"""

import importlib.util
import os
import signal
import sys
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = "solution" if os.environ.get("KATA_TARGET") == "solution" else "src"

_spec = importlib.util.spec_from_file_location("katas", ROOT / FOLDER / "katas.py")
assert _spec and _spec.loader
katas = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(katas)


@contextmanager
def time_limit(seconds: float):
    """Fail like an assessment's TIMEOUT ERROR instead of hanging on a quadratic answer."""
    if sys.platform == "win32":  # No SIGALRM on Windows; run without a limit.
        yield
        return

    def on_timeout(signum, frame):
        raise TimeoutError(f"took longer than {seconds}s: expected O(N)")

    previous = signal.signal(signal.SIGALRM, on_timeout)
    signal.setitimer(signal.ITIMER_REAL, seconds)
    try:
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)
