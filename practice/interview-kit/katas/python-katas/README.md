# Python katas

Three online-assessment tasks in `src/katas.py`, for Python 3.12. The only dependency is
pytest. Each has correctness tests and a performance test with a time limit, which fails
like an assessment's TIMEOUT ERROR when the answer is quadratic.

Set up once, from this folder:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
pip install pytest
```

Run the tests against your code:

```sh
python -m pytest
```

Run the same tests against the reference solution:

```sh
KATA_TARGET=solution python -m pytest
```

From the kit root, `pnpm kata python-katas` and `pnpm kata python-katas --solution` do the
same, using `python3` (or whatever `PYTHON` points at).

See `BRIEF.md` for how to practise these under online-assessment conditions.
