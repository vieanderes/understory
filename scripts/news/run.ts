/**
 * `pnpm news`: the Signal pipeline as a plain Node CLI.
 *
 * Exit codes: 0 when a day was written (or there was nothing to write), 1 on any failure.
 * On failure nothing is written, so the workflow that calls this has nothing to commit.
 */
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { FileNewsStore } from '@/adapters/news-file';
import { parseArgs, USAGE } from './cli';
import { loadConfig } from './config';
import { createAnthropicSummariser, DEFAULT_MODEL, type Summariser } from './llm';
import { runPipeline } from './pipeline';
import { arxivSource } from './sources/arxiv';
import { feedSource } from './sources/feeds';
import { hnSource } from './sources/hn';

async function main(): Promise<void> {
  const now = new Date();
  const options = parseArgs(process.argv.slice(2), now);
  if (options.help) {
    console.log(USAGE);
    return;
  }

  const root = process.cwd();
  const config = await loadConfig(root);
  const http = {
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
    sleep: (ms: number) => sleep(ms),
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const useLlm = !options.noLlm && apiKey !== undefined && apiKey.length > 0;
  const summariser: Summariser | null = useLlm
    ? createAnthropicSummariser(http, {
        apiKey,
        model: process.env.SIGNAL_MODEL ?? DEFAULT_MODEL,
        interests: config.interests,
        lessonIndex: config.lessonIndex,
      })
    : null;
  // Progress goes to stderr, so `--dry-run` leaves clean JSON on stdout.
  console.error(
    summariser === null ? 'Briefs: extractive (no model)' : `Briefs: ${summariser.model}`,
  );

  const store = new FileNewsStore(process.env.NEWS_DATA_DIR ?? path.join(root, 'data', 'news'));
  const result = await runPipeline(
    {
      ...http,
      store,
      sources: [hnSource, arxivSource, ...config.feeds.map(feedSource)],
      config,
      summariser,
      now,
      log: (line) => console.error(line),
    },
    options,
  );

  if (options.dryRun) console.log(JSON.stringify(result.day, null, 2));

  // In GitHub Actions the commit step needs the subject line. The pipeline knows the date
  // and the count, so it says so here and the workflow does no JSON parsing in shell.
  const outputFile = process.env.GITHUB_OUTPUT;
  if (result.written && outputFile !== undefined) {
    const stored = await store.day(options.date);
    const count = stored?.items.length ?? result.day.items.length;
    await appendFile(outputFile, `message=Signal: ${options.date} (${count} items)\n`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
