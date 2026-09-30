import {
  DEFAULT_SELECTION,
  addDays,
  classify,
  dedupe,
  exclusionReason,
  extractiveBrief,
  isoWeekKey,
  monthKey,
  monthRange,
  newsDaySchema,
  normalise,
  rollup,
  score,
  selectDay,
  validateBrief,
  weekRange,
  type Brief,
  type DigestPeriod,
  type IsoDate,
  type NewsDay,
  type NewsItem,
  type RawItem,
  type SourceReport,
} from '@/core/news';
import type { NewsDigestStore, NewsStore } from '@/core/ports/news-store';
import type { SignalConfig } from './config';
import { mapWithConcurrency, type HttpDeps } from './http';
import type { Summariser } from './llm';
import type { Source, SourceContext } from './sources/types';

/*
 * fetch -> normalise -> dedupe -> classify -> score -> select -> brief -> validate -> write
 *
 * Everything the run touches arrives through `PipelineDeps`, so the same function runs in
 * GitHub Actions, on a VPS against Postgres, and in the tests against fixtures.
 */

/** Sources are independent hosts, so they can be asked at the same time. */
const SOURCE_CONCURRENCY = 6;
/** One model request per item, at most this many in flight. Bounds cost and rate limits. */
const LLM_CONCURRENCY = 3;
/** Older items are not news. Wide enough to cover a weekend for a Monday run. */
const MAX_AGE_HOURS = 72;
/** An item shown on one of the last days is not shown again. */
const SEEN_WINDOW_DAYS = 14;
const MS_PER_HOUR = 3_600_000;

export interface PipelineDeps extends HttpDeps {
  store: NewsStore & Partial<NewsDigestStore>;
  sources: readonly Source[];
  config: SignalConfig;
  /** Null runs without a model: every brief is extractive. */
  summariser: Summariser | null;
  now: Date;
  log: (line: string) => void;
}

export interface PipelineOptions {
  date: IsoDate;
  dryRun: boolean;
  max: number;
}

export interface PipelineResult {
  day: NewsDay;
  written: boolean;
  /** Why a model-written brief was replaced, per item id. Logged, never stored. */
  fallbacks: Record<string, string>;
}

/** Every source failed. Nothing is written, and the process exits non-zero. */
export class AllSourcesFailedError extends Error {
  constructor(readonly reports: readonly SourceReport[]) {
    super(`All ${reports.length} sources failed. Nothing was written.`);
    this.name = 'AllSourcesFailedError';
  }
}

interface Fetched {
  raw: RawItem[];
  reports: SourceReport[];
}

async function fetchAll(deps: PipelineDeps): Promise<Fetched> {
  const ctx: SourceContext = {
    fetch: deps.fetch,
    sleep: deps.sleep,
    now: deps.now,
    interests: deps.config.interests,
  };
  const results = await mapWithConcurrency(deps.sources, SOURCE_CONCURRENCY, async (source) => {
    try {
      const items = await source.fetch(ctx);
      return { items, report: { id: source.id, ok: true, count: items.length } };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      deps.log(`  source ${source.id} failed: ${message}`);
      return { items: [], report: { id: source.id, ok: false, count: 0, error: message } };
    }
  });
  const reports = results.map((result) => result.report);
  if (reports.length === 0 || reports.every((report) => !report.ok)) {
    throw new AllSourcesFailedError(reports);
  }
  return { raw: results.flatMap((result) => result.items), reports };
}

function isFresh(item: NewsItem, now: Date): boolean {
  return now.getTime() - Date.parse(item.publishedAt) <= MAX_AGE_HOURS * MS_PER_HOUR;
}

async function recentlyShown(store: NewsStore, date: IsoDate): Promise<Set<string>> {
  const days = await store.range(addDays(date, -SEEN_WINDOW_DAYS), addDays(date, -1));
  return new Set(days.flatMap((day) => day.items.map((item) => item.id)));
}

interface Briefed {
  item: NewsItem;
  fallback?: string;
}

async function briefOne(
  item: NewsItem,
  stored: Brief | undefined,
  deps: PipelineDeps,
): Promise<Briefed> {
  const { interests, lessonIndex } = deps.config;
  // A re-run pays for nothing twice, unless it can upgrade an extractive brief.
  if (stored !== undefined && (stored.generatedBy === 'llm' || deps.summariser === null)) {
    return { item: { ...item, brief: stored } };
  }
  const extractive = (): NewsItem => ({
    ...item,
    brief: extractiveBrief(item, lessonIndex, interests),
  });
  if (deps.summariser === null) return { item: extractive() };

  try {
    const brief: Brief = {
      ...(await deps.summariser.brief(item)),
      generatedBy: 'llm',
      model: deps.summariser.model,
    };
    const verdict = validateBrief(brief, item, lessonIndex);
    if (!verdict.ok) return { item: extractive(), fallback: verdict.problems.join(' ') };
    return { item: { ...item, brief } };
  } catch (error) {
    // One failed request, one odd answer: that item gets the extractive brief. The run goes on.
    return { item: extractive(), fallback: error instanceof Error ? error.message : String(error) };
  }
}

async function updateRollups(deps: PipelineDeps, date: IsoDate): Promise<void> {
  const { store } = deps;
  if (store.putDigest === undefined) return;
  const periods: [DigestPeriod, string, ReturnType<typeof weekRange>][] = [
    ['week', isoWeekKey(date), weekRange(isoWeekKey(date))],
    ['month', monthKey(date), monthRange(monthKey(date))],
  ];
  for (const [period, key, range] of periods) {
    if (range === null) continue;
    const digest = rollup(await store.range(range.from, range.to), period, key);
    if (digest !== null) await store.putDigest(digest);
  }
}

export async function runPipeline(
  deps: PipelineDeps,
  options: PipelineOptions,
): Promise<PipelineResult> {
  const { interests } = deps.config;
  const { log, now } = deps;

  log(`Signal ${options.date}: fetching ${deps.sources.length} sources`);
  const { raw, reports } = await fetchAll(deps);

  const normalised = raw.flatMap((item) => normalise(item, now) ?? []);
  const fresh = normalised.filter((item) => isFresh(item, now));
  const unique = dedupe(fresh);
  const classified = unique.map((item) => ({ ...item, topics: classify(item, interests) }));
  const excluded = classified.filter((item) => exclusionReason(item, interests) !== null);
  const scored = classified.map((item) => ({ ...item, score: score(item, interests, now) }));

  const shown = await recentlyShown(deps.store, options.date);
  const selected = selectDay(
    scored.filter((item) => !shown.has(item.id)),
    { ...DEFAULT_SELECTION, max: options.max, minScore: interests.minScore },
  );
  log(
    `  ${raw.length} fetched, ${fresh.length} fresh, ${unique.length} after dedupe, ` +
      `${excluded.length} excluded, ${selected.length} selected`,
  );

  const stored = await deps.store.day(options.date);
  const storedBriefs = new Map(stored?.items.map((item) => [item.id, item.brief]));
  const briefed = await mapWithConcurrency(selected, LLM_CONCURRENCY, (item) =>
    briefOne(item, storedBriefs.get(item.id), deps),
  );
  const fallbacks: Record<string, string> = {};
  for (const { item, fallback } of briefed) {
    if (fallback !== undefined) {
      fallbacks[item.id] = fallback;
      log(`  brief for "${item.title}" fell back to extractive: ${fallback}`);
    }
  }

  const items = briefed.map((entry) => entry.item);
  // The last gate. A day that fails the schema throws here, before anything is written.
  const day = newsDaySchema.parse({
    date: options.date,
    generatedAt: now.toISOString(),
    items,
    stats: {
      fetched: raw.length,
      afterDedupe: unique.length,
      excluded: excluded.length,
      selected: items.length,
      llmBriefs: items.filter((item) => item.brief?.generatedBy === 'llm').length,
      extractiveBriefs: items.filter((item) => item.brief?.generatedBy === 'extractive').length,
      sources: reports,
    },
  } satisfies NewsDay);

  if (options.dryRun) {
    log('  dry run: nothing written');
    return { day, written: false, fallbacks };
  }
  if (day.items.length === 0) {
    // A quiet day is not an error, and an empty file would only be noise in the app.
    log('  no item passed selection: nothing written');
    return { day, written: false, fallbacks };
  }

  await deps.store.putDay(day);
  await updateRollups(deps, options.date);
  log(`  wrote ${options.date} (${day.items.length} items)`);
  return { day, written: true, fallbacks };
}
