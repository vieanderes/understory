import json
import sys
from pathlib import Path


def report(results):
    passed = sum(1 for r in results if r["passed"])
    return [f"{passed} of {len(results)} passed"]


def main(argv):
    if len(argv) != 2:
        print("usage: report.py FILE")
        return 2
    path = Path(argv[1])
    if not path.exists():
        print(f"No such file: {argv[1]}")
        return 1
    results = json.loads(path.read_text())
    for line in report(results):
        print(line)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
