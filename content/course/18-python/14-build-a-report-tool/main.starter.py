import json
import sys
from pathlib import Path


def report(results):
    passed = sum(1 for r in results if r["passed"])
    return [f"{passed} of {len(results)} passed"]


def main(argv):
    # Your code here
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
