# Rate-limited crawler

Format: live coding in two phases, 60 minutes. TypeScript. Phase 1 is sequential; phase 2
makes it concurrent and polite. Reports describe a sequential answer at phase 2 as a no-hire.

## The prompt

"Given a start URL and a `fetchPage` function that returns a page's status and links, crawl
the site. Visit each page once. Then: make it fast, but do not hammer any single host."

## The contract

Implement `crawl(options)` in `src/crawler.ts`. It resolves with
`{ pages: CrawledPage[], errors: CrawlError[] }`.

- `startUrl` is depth 0. Links on a page at depth d are at depth d + 1. Do not fetch
  anything deeper than `maxDepth`.
- Resolve relative links against the page URL. Drop `#fragments`. Ignore anything that is
  not `http:` or `https:`. Fetch each normalised URL at most once.
- Only follow hosts in `allowedHosts`, which defaults to the start URL's host.
- Never have more than `maxConcurrency` fetches in flight across all hosts.
- Per host, start requests at least `perHostIntervalMs` apart.
- A fetch that throws, or returns a status of 400 or more, goes into `errors` as
  `{ url, message }`; its links are not followed. The crawl carries on.
- A successful page goes into `pages` as `{ url, depth, status }`.
- Timing comes from the injected `now()` and `sleep(ms)`, defaulting to `Date.now` and a
  `setTimeout` promise. The tests use fake timers.

The fake site in `fixtures/fake-site.ts` is the only "network". Read it: it records every
request's start time and the peak number in flight.

## Constraints

- No network, no libraries. Order of `pages` does not matter.

## What the interviewer looks for

- Dedupe on enqueue, not on fetch, or two workers fetch the same URL.
- Knowing when the crawl is finished: the queue is empty and nothing is in flight.
- A concurrency limit that holds across hosts, and a per-host schedule that does not block
  other hosts while one waits.
- Talk: robots.txt, `Retry-After` on 429, canonical URLs and query-string explosions, a
  budget on total pages, and how you would distribute this across machines.

Run: `pnpm kata rate-limited-crawler`. Reference: `pnpm kata rate-limited-crawler --solution`.
