# Python katas: a timed online test

Format: a timed online-assessment screen. 90 minutes for three tasks, one timer, no pausing. Hidden
tests score correctness and performance; the example in the statement does not count.

## The tasks

Each docstring in `src/katas.py` is the task statement, with its constraints and the
expected worst-case time. Read that line first: it names the algorithm.

1. `smallest_missing_positive` (counting elements).
2. `max_slice_sum` (maximum slice).
3. `is_properly_nested` (stacks).

## How to rehearse

- Start `pnpm timer 90`. Read all three statements and their complexity lines (5 min).
- Solve the most familiar task first. Submit something that runs for every task; code that
  does not compile, or here raises, scores 0.
- Before you run the visible tests, write your own cases: the smallest input, the largest,
  all equal, all negative, duplicates, sorted and reverse sorted.
- If the fast idea does not come for the last task, write the brute force. It usually scores
  full correctness and partial performance.
- Keep five minutes to reread each function.

## What the reviewer sees

The score, per test OK, WRONG ANSWER or TIMEOUT ERROR, and a detected time complexity. In a
live round the same tasks are asked aloud: say the brute force and its cost, then improve it
and say why it is faster.
