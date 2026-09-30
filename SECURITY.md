# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub instead: on the repository's **Security** tab, choose
**Report a vulnerability**. Describe what you found, how to reproduce it, and what an
attacker could do with it.

You will get an answer as soon as possible, usually within a week. Once a fix is out, the
report can be made public, with credit to you if you want it.

## Scope

Of most interest:

- The code sandbox: learner code escaping the iframe or the worker (`docs/SANDBOX.md`).
- Scout's assistant routes and the MCP server: anything that exposes a learner's key, their
  conversation or another learner's session.
- Anything that lets a page read or change another learner's local progress.

Understory keeps progress on the learner's device and has no accounts, so there is no
server-side user data to reach.
