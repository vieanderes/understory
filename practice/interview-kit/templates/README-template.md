# <Project name>

<!-- Reviewers often read this before any code, and some read only this. Keep it true and
short. Delete these comments. -->

## What it is

One or two sentences: who it is for and what it does. Then the three must-haves, each
marked done, partial or not started.

- [x] ...
- [x] ...
- [ ] ...

## How to run it

Tested on a clean checkout with Node <version> and <other tools>.

```sh
cp .env.example .env    # only if a key is needed; say which, and that it is optional
pnpm install
pnpm dev                # http://localhost:3000
pnpm test
pnpm eval               # AI builds: prints the eval summary
```

Without a model key it runs with <the fake / canned responses>, so every path can be tried.

## Assumptions

What the brief left open, and what I decided. A reviewer should be able to disagree with
each one.

- ...
- ...

## Architecture

```
  Browser                     Server                         Data
 +-----------+   HTTP/SSE   +------------------+           +-----------+
 |  UI       | -----------> |  API routes      | --------> |  Store    |
 |  (React)  | <----------- |  validation      |           +-----------+
 +-----------+              |  core logic      | --------> +-----------+
                            +------------------+           |  Model    |
                                                           +-----------+
```

One paragraph on the flow of one request. Name the files where the core logic lives.

## Decisions and trade-offs

For each: what I chose, what I rejected, why, and what would change my mind.

| Decision | Instead of | Because | I would revisit if |
| -------- | ---------- | ------- | ------------------ |
| ...      | ...        | ...     | ...                |

## How I used AI, and how I checked it

- Which tool, for what: scaffolding, a first draft of X, test cases.
- What I wrote myself and why: the core logic, anything security-related.
- How I verified generated code: tests, reading it line by line, running Y.
- One thing it got wrong and how I caught it.

## Testing

- What is tested and where: unit tests on <core logic>, an integration test on <route>.
- What is not tested and why.
- AI builds: the eval set (size, how it was built), the metrics, the current numbers.

## Known gaps

What does not work, what is slow, what is insecure. Saying it first is better than being
asked.

## Next steps

In order, with a rough size:

1. ...
2. ...
3. ...
