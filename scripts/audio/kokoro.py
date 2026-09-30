"""Reads a queue of scripts aloud with Kokoro and writes one AAC file per script.

Called by scripts/build-audio.ts, which writes the queue:
  [{"id": "...", "text": "<path to .txt>", "out": "<path to .m4a>", "hash": "..."}, ...]
Each finished file is recorded in the record JSON (id -> {"hash", "seconds"}) at once, so
an interrupted run resumes where it stopped. Run through uv, which fetches the dependencies:
  uv run --python 3.12 --with mlx-audio --with "misaki[en]" --with soundfile \
    python scripts/audio/kokoro.py <queue.json> <record.json> [voice]
"""

import json
import pathlib
import subprocess
import sys
import time

import numpy as np
import soundfile as sf
from mlx_audio.tts.utils import load_model

RATE = 24000
PAUSE = np.zeros(int(RATE * 0.6), dtype=np.float32)


def main() -> None:
    queue = json.loads(pathlib.Path(sys.argv[1]).read_text())
    record_path = pathlib.Path(sys.argv[2])
    voice = sys.argv[3] if len(sys.argv) > 3 else "bf_emma"
    record = json.loads(record_path.read_text()) if record_path.exists() else {}
    model = load_model("mlx-community/Kokoro-82M-bf16")
    started = time.time()
    for n, job in enumerate(queue, 1):
        text = pathlib.Path(job["text"]).read_text()
        pieces = []
        # Paragraph by paragraph: the silence between them is the pause the page has.
        for para in (p.strip() for p in text.split("\n\n")):
            if not para:
                continue
            for result in model.generate(text=para, voice=voice, speed=1.0, lang_code="b"):
                pieces.append(np.array(result.audio, dtype=np.float32))
            pieces.append(PAUSE)
        audio = np.concatenate(pieces) if pieces else PAUSE
        out = pathlib.Path(job["out"])
        out.parent.mkdir(parents=True, exist_ok=True)
        wav = out.with_suffix(".part.wav")
        sf.write(str(wav), audio, RATE)
        tmp = out.with_suffix(".part.m4a")
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", str(wav), "-c:a", "aac", "-b:a", "48k",
             "-ac", "1", "-movflags", "+faststart", str(tmp)],
            check=True,
        )
        wav.unlink()
        tmp.rename(out)
        seconds = round(len(audio) / RATE)
        record[job["id"]] = {"hash": job["hash"], "seconds": seconds}
        record_path.write_text(json.dumps(record, indent=1))
        print(f"{n}/{len(queue)} {job['id']} {seconds}s audio, {time.time() - started:.0f}s elapsed", flush=True)


if __name__ == "__main__":
    main()
