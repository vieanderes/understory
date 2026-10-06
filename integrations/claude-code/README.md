# Understory for Claude Code

> **Not offered to learners yet.** Claude Code runs a channel like this one without a
> developer warning only once Anthropic has approved it. Until Understory's is approved,
> Scout tells Claude Code users so and connects them with `claude mcp add` instead. The
> steps below are for developers trying the plugin.

Ask in Understory's Scout, and Claude Code answers: each question arrives in your session as
a [channel](https://code.claude.com/docs/en/channels-reference) event, and the answer goes
back to Scout.

```sh
claude plugin marketplace add vieanderes/understory && claude plugin install understory@understory
claude --dangerously-load-development-channels plugin:understory@understory
```

Then send Claude the line Scout shows, "Connect Understory at <site>, code ABCD-EFGH", and
press Allow in Scout.

Channels are a research preview. Until this one is on Anthropic's allowlist, Claude Code
needs the development flag and asks you to confirm; on Team and Enterprise plans an admin
must turn channels on.

`channel.mjs` has no dependencies. It is a client of the site's `/api/mcp`: it calls
`wait_for_question` in a loop, pushes each question into the session, and sends Claude's
answer with `reply`. How the connection stays safe is in `docs/ONLINE-TEST.md`, section 6.
