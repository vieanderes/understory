import json
from pathlib import Path


def save_scores(path, scores):
    Path(path).write_text(json.dumps(scores, indent=2))


def load_scores(path):
    file = Path(path)
    if not file.exists():
        return {}
    return json.loads(file.read_text())
