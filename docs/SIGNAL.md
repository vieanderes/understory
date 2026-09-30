# Signal

Signal is the news section of Understory: a daily, weekly and monthly digest of software
engineering and AI news for one reader. Each item is explained inside the app in a fixed
structure, so the app alone is enough to understand the concept. Links lead to the source
for depth.

The decisions behind it are in `ARCHITECTURE.md` (rows "News pipeline" to "News bot
rights"). This document describes how it works and how to change it.

## What runs, and where

| Part                 | Location                                              | Notes                                                     |
| -------------------- | ----------------------------------------------------- | --------------------------------------------------------- |
| Rules                | `src/core/news/`                                      | Pure TypeScript, no Node, no network. Written test first. |
| Store port           | `src/core/ports/news-store.ts`                        | `NewsStore`, plus the optional `NewsDigestStore`.         |
| File store           | `src/adapters/news-file/`                             | JSON files under `data/news/`.                            |
| Getters for pages    | `src/lib/news/index.ts`                               | The only import surface for server components.            |
| Pipeline and sources | `scripts/news/`                                       | A plain Node CLI, run with `tsx`.                         |
| Reader profile       | `content/interests.yaml`                              | Topics, weights, glossary, lesson index, blocked terms.   |
| Feed list            | `content/feeds.yaml`                                  | Id, name, URL, weight and topics per feed.                |
| Schedule             | `.github/workflows/news.yml`                          | Daily at 05:30 UTC, and on demand.                        |
| Data                 | `data/news/YYYY/MM/DD.json`, `index.json`, `digests/` | Committed by the workflow. About 10 MB a year.            |

## The pipeline

```text
content/feeds.yaml ─┐
content/interests.yaml ─┤
                        ▼
   fetch        Hacker News (Algolia) · arXiv API · RSS and Atom feeds
     │          one Source per feed; a failed source is reported, not fatal;
     │          if every source fails the run stops and writes nothing
     ▼
   normalise    clean title, canonical URL, id = hash of canonical URL,
     │          excerpt cut to 280 characters, dates clamped to now
     ▼
   freshness    drop items older than 72 hours
     ▼
   dedupe       same canonical URL, or title similarity (Jaccard) >= 0.8;
     │          keep the best-sourced copy, merge points and the discussion link
     ▼
   classify     topics by keyword rules, strongest first, plus the feed's own topics
     ▼
   score        weighted sum, see below; blocked terms and domains score 0
     ▼
   select       not shown in the last 14 days; max 12; at most 4 per primary topic
     │          and 5 per source; items with no topic are left out
     ▼
   brief        model-written when ANTHROPIC_API_KEY is set, else extractive;
     │          every model brief passes zod and validateBrief or falls back, per item
     ▼
   validate     the whole day against newsDaySchema; a failure stops the run here
     ▼
   write        NewsStore.putDay (merge by item id, keep stored briefs),
                then the week and month roll-ups
```

Every step between fetch and write is a pure function in `src/core/news/`. The pipeline in
`scripts/news/pipeline.ts` only wires them together, and everything it touches (fetch,
sleep, clock, store, summariser) is passed in. That is what lets the tests run the whole
pipeline over recorded fixtures without a network.

## Sources

All sources implement one interface:

```ts
interface Source {
  id: string;
  fetch(ctx: SourceContext): Promise<RawItem[]>;
}
```

- **Hacker News** (`sources/hn.ts`). One request to the Algolia search API: stories of the
  last 24 hours with more than 100 points. Stories that match none of the interests are
  dropped in the adapter. The submitter is not recorded as an author.
- **arXiv** (`sources/arxiv.ts`). The public Atom API for cs.SE, cs.AI, cs.LG, cs.CL, cs.DC,
  cs.DB and cs.HC, newest first, two pages of 100. Requests are three seconds apart, as the
  arXiv terms ask. Only the first 280 characters of an abstract are kept.
- **Feeds** (`sources/feeds.ts`, `sources/xml.ts`). RSS 2.0, RSS 1.0 and Atom. The newest 15
  entries per feed are read. Entries without a date are skipped. XML entities are not
  expanded by the parser.

Manners, in `scripts/news/http.ts`: a User-Agent that names the project, a 20 second
timeout, one retry after a pause (only for network errors, 429 and 5xx), and a 12 MB cap
on a response.

### Add a feed

1. Check that the URL answers with RSS or Atom: `curl -sL <url> | head`.
2. Add an entry to `content/feeds.yaml` with a new `id`, a `weight` from 0 to 1 and one or
   two `topics` from `interests.yaml`.
3. Run `pnpm news --dry-run --no-llm` and look for the feed id in `stats.sources`.

The file header lists the feeds that were checked and left out, with the reason.

### Add another kind of source

Write a `Source` in `scripts/news/sources/`, add a recorded response under
`tests/unit/scripts/news/fixtures/`, test the parser against it, and add the source to the
list in `scripts/news/run.ts`. If it is a new `kind`, extend `sourceKindSchema` and give it a
default weight in `interests.yaml`.

## Scoring

```text
score = wTopic * topic + wSource * source + wEngagement * engagement + wRecency * recency
```

| Part       | Range     | Rule                                                                        |
| ---------- | --------- | --------------------------------------------------------------------------- |
| topic      | 0 to 1.25 | Weight of the primary topic, plus 0.25 times the best other topic.          |
| source     | 0 to 1    | Weight of the feed from `feeds.yaml`, else the default for the source kind. |
| engagement | 0 to 1    | `ln(1 + points + 2 * comments) / ln(1 + 3000)`, capped at 1.                |
| recency    | 0 to 1    | `0.5 ^ (ageHours / halfLifeHours)`. A date in the future counts as now.     |

The weights and the half-life are in `content/interests.yaml`. Two properties are tested:
more points or comments never lower a score, and age never raises it. A title with a
blocked term, or a URL on a blocked domain, scores 0 and can never be selected. The score is
rounded to three decimals so stored files do not change on float noise.

Selection is greedy by score with two caps, so one topic or one source cannot fill a day.
Ties break by item id, which makes a re-run over the same input pick the same day.

## The brief

Every item carries one brief with a fixed shape (`briefSchema`):

| Field            | Limit                                          |
| ---------------- | ---------------------------------------------- |
| `whatHappened`   | at most 60 words                               |
| `whyItMatters`   | at most 50 words                               |
| `keyConcepts`    | 2 to 4, each explanation at most 30 words      |
| `relatedLessons` | up to 3 lesson ids from the lesson index       |
| `recallCards`    | 0 to 2 question and answer pairs               |
| `readingLevel`   | `quick` or `deep`                              |
| `generatedBy`    | `llm` or `extractive`, shown to the reader     |
| `model`          | the model id, only when `generatedBy` is `llm` |

`validateBrief` applies the house rules on top of the schema: the word limits, lessons that
exist, no URL other than the item's own, no first person and no exclamation marks.

**Model-written.** `scripts/news/llm.ts` calls the Anthropic Messages API with `fetch`. No
SDK is installed: it is one POST request, and the pipeline stays dependency-free. The model
is given the title, the excerpt, the source name, the topic labels and the lesson index. It
is never given a URL or an article. The prompt asks for British English, plain sentences, no
invented facts, and the phrase "the source does not say" when the input does not settle
something. The answer is requested as JSON through structured outputs, parsed by zod, then
checked by `validateBrief`. Any failure (HTTP error, refusal, cut-off answer, invalid JSON,
a broken rule) replaces that one brief with the extractive one. The run continues.

**Extractive.** `extractiveBrief` needs no key. `whatHappened` is a fixed sentence around
the headline, followed by whole sentences of the excerpt that are not first person.
`whyItMatters` is the `why` sentence of the item's primary topic. `keyConcepts` are
glossary entries named in the text, filled up to two from the topic's own entries. Lessons
are matched by keyword. It states nothing that is not in the item or in `interests.yaml`.

`relatedLessons` ids come from the `lessons` list in `interests.yaml`, which follows
`CURRICULUM.md` and is written ahead of the lessons. The app should show a link only when the
id resolves in the content manifest.

## Cost, and running without a key

- One request per item, at most `--max` items (default 12, limit 20), three requests in
  flight, `max_tokens` 1200, thinking disabled. The system prompt is marked cacheable.
- A re-run reuses stored model briefs and sends no request for them.
- The model id comes from `SIGNAL_MODEL`. The default is `claude-sonnet-5`, as in
  `.env.example`. A request is about 1,800 input and 450 output tokens, so a day of 12
  items costs roughly 10 US cents at the list prices known when this was written (2 and 10
  US dollars per million tokens). Check current prices before relying on this.
- Without `ANTHROPIC_API_KEY`, or with `--no-llm`, every brief is extractive and the run
  costs nothing. The first day in the repository, 2026-09-17, was made this way.

## Legal stance

- Signal stores the title, the link, source-provided metadata (authors, date, points) and
  its own summary. It never fetches or stores an article body. The schema has no field that
  could hold one.
- The excerpt is the description the source itself published in its feed or API, stripped
  to plain text and cut to 280 characters.
- Every item names its source and links to it. Hacker News items also link to the thread.
- Every brief is labelled by how it was made. Model-written briefs name the model. The app
  must show the label "AI-summarised" next to them.
- Feeds are fetched once a day with an identifying User-Agent. arXiv is rate limited as its
  terms require.

## Run it locally

Add this line to the `scripts` of `package.json` (the milestone did not edit that file):

```json
"news": "tsx scripts/news/run.ts"
```

```bash
pnpm news --dry-run --no-llm     # fetch, rank and print the day as JSON, write nothing
pnpm news --no-llm               # write data/news with extractive briefs
ANTHROPIC_API_KEY=... pnpm news  # model-written briefs
pnpm news --date 2026-09-17 --max 8
pnpm exec tsx scripts/news/validate.ts   # check every file under data/news
```

### Backfill

`pnpm news:backfill --from 2026-08-01 --to 2026-09-16` writes the days a daily run would
have written. Each day runs the same pipeline with the clock set to 05:30 UTC of that day.
Hacker News and arXiv are asked for a closed time window. Each feed is fetched once, and
entries newer than the day's clock are hidden, so a busy feed adds little to old days.
Briefs are extractive, existing days are skipped, and a story that a later day already
shows is left out. The days before 2026-09-17 in the repository were made this way.

Until the script line exists, `pnpm exec tsx scripts/news/run.ts` does the same. Progress is
printed to stderr, and `--dry-run` prints the day to stdout. The exit code is 1 on any
failure, and a failed run writes nothing. `NEWS_DATA_DIR` points the store, the validator
and the app getters at another folder.

Tests never touch the network:

```bash
pnpm exec vitest run tests/unit/core/news tests/unit/adapters/news-file tests/unit/scripts/news
```

## The workflow

`.github/workflows/news.yml` runs daily at 05:30 UTC and by hand. It has `contents: write`
and nothing else. A concurrency group keeps two runs from overlapping. The steps are:
install, run the pipeline, validate `data/news`, and commit only when `data/news` changed,
as `github-actions[bot]`, with a subject such as `Signal: 2026-09-17 (11 items)`. If the
commit cannot be replayed because another run wrote the same day first, the job drops its
commit and ends green. If the pipeline or the validation fails, the job ends red and
nothing is committed, so the default branch always holds the last good day.
`ANTHROPIC_API_KEY` is an optional repository secret, and `SIGNAL_MODEL` an optional
repository variable. The CI workflow ignores pushes that only touch `data/news/**`.

## Moving to a VPS

Nothing in the pipeline depends on GitHub or Vercel.

1. Write `PostgresNewsStore` in `src/adapters/news-postgres/` against the same `NewsStore`
   port: a `news_days` table keyed by date with the day as `jsonb`, and `putDay` as one
   transaction that reads the stored day, applies `mergeDay` and upserts. Run the file store
   tests against it as a contract suite.
2. Choose the store in `scripts/news/run.ts` and in `src/lib/news/index.ts` from an
   environment variable such as `NEWS_STORE=postgres`.
3. Replace the cron workflow with a systemd timer:

```ini
# /etc/systemd/system/signal-news.service
[Service]
Type=oneshot
WorkingDirectory=/srv/understory
EnvironmentFile=/etc/understory/signal.env
ExecStart=/usr/bin/pnpm exec tsx scripts/news/run.ts

# /etc/systemd/system/signal-news.timer
[Timer]
OnCalendar=*-*-* 05:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```

`Type=oneshot` means systemd never starts a second run while one is active, which replaces
the concurrency group. `Persistent=true` catches up after downtime, and the pipeline is
idempotent, so a late or repeated run is safe. With a database the news pages can no longer
be fully static. Give them a revalidation period of an hour or so.
