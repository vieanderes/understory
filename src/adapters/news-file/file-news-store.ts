import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type * as z from '@/core/zod';
import {
  isoDateSchema,
  mergeDay,
  newsDaySchema,
  newsDigestSchema,
  type DigestPeriod,
  type IsoDate,
  type NewsDay,
  type NewsDigest,
} from '@/core/news';
import type { NewsDigestStore, NewsStore } from '@/core/ports/news-store';

/*
 * News as JSON files in the repository:
 *
 *   data/news/2026/09/17.json      one NewsDay
 *   data/news/index.json           { "dates": [...] }, newest first
 *   data/news/digests/week/2026-W38.json
 *   data/news/digests/month/2026-09.json
 *
 * The files are committed by a bot every day, so diffs must stay small: two-space
 * indentation, keys in schema order, a trailing newline. Parsing through the zod schema
 * rebuilds every object in schema order, which is what makes the key order stable.
 */

const INDEX_FILE = 'index.json';
const DIGEST_DIR = 'digests';
const JSON_INDENT = 2;
const DIGEST_KEY = /^\d{4}-(W\d{2}|\d{2})$/;
const YEAR_DIR = /^\d{4}$/;
const MONTH_DIR = /^\d{2}$/;
const DAY_FILE = /^(\d{2})\.json$/;

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function serialise(value: unknown): string {
  return `${JSON.stringify(value, null, JSON_INDENT)}\n`;
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as unknown;
  } catch (error) {
    if (isMissing(error)) return null;
    throw new Error(
      `Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Write to a sibling and rename, so a crash never leaves half a file for the app to read. */
async function writeAtomic(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  await writeFile(temporary, content, 'utf8');
  await rename(temporary, file);
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const where = first === undefined ? '' : ` at ${first.path.join('.')}: ${first.message}`;
  throw new Error(`${what} is not valid${where}`);
}

async function listDir(dir: string, pattern: RegExp): Promise<string[]> {
  try {
    return (await readdir(dir)).filter((name) => pattern.test(name));
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
}

export class FileNewsStore implements NewsStore, NewsDigestStore {
  constructor(readonly root: string) {}

  private dayFile(date: IsoDate): string {
    // The date becomes a path. Validating it first keeps `../` out of the data folder.
    const [year, month, dayOfMonth] = isoDateSchema.parse(date).split('-') as [
      string,
      string,
      string,
    ];
    return path.join(this.root, year, month, `${dayOfMonth}.json`);
  }

  private digestFile(period: DigestPeriod, key: string): string {
    if (!DIGEST_KEY.test(key)) throw new Error(`"${key}" is not a digest key.`);
    return path.join(this.root, DIGEST_DIR, period, `${key}.json`);
  }

  async day(date: IsoDate): Promise<NewsDay | null> {
    const file = this.dayFile(date);
    const raw = await readJson(file);
    return raw === null ? null : parseOrThrow(newsDaySchema, raw, file);
  }

  async range(from: IsoDate, to: IsoDate): Promise<NewsDay[]> {
    const dates = (await this.listDates()).filter((date) => date >= from && date <= to).sort();
    const days = await Promise.all(dates.map((date) => this.day(date)));
    return days.filter((day): day is NewsDay => day !== null);
  }

  async latestDate(): Promise<IsoDate | null> {
    return (await this.listDates())[0] ?? null;
  }

  /** Newest first. Reads the index, and falls back to the folders when it is missing. */
  async listDates(): Promise<IsoDate[]> {
    const index = await readJson(path.join(this.root, INDEX_FILE));
    if (index !== null && typeof index === 'object' && 'dates' in index) {
      const parsed = isoDateSchema.array().safeParse(index.dates);
      if (parsed.success) return parsed.data;
    }
    return this.scanDates();
  }

  async putDay(day: NewsDay): Promise<void> {
    const incoming = parseOrThrow(newsDaySchema, day, `The day ${day.date}`);
    const merged = parseOrThrow(
      newsDaySchema,
      mergeDay(await this.day(incoming.date), incoming),
      `The merged day ${day.date}`,
    );
    await writeAtomic(this.dayFile(merged.date), serialise(merged));
    await this.writeIndex();
  }

  async digest(period: DigestPeriod, key: string): Promise<NewsDigest | null> {
    const file = this.digestFile(period, key);
    const raw = await readJson(file);
    return raw === null ? null : parseOrThrow(newsDigestSchema, raw, file);
  }

  /** Keys of the stored roll-ups of one period, oldest first. Used by the validator. */
  async listDigestKeys(period: DigestPeriod): Promise<string[]> {
    const files = await listDir(path.join(this.root, DIGEST_DIR, period), /\.json$/);
    return files.map((file) => file.replace(/\.json$/, '')).sort();
  }

  async putDigest(digest: NewsDigest): Promise<void> {
    const valid = parseOrThrow(newsDigestSchema, digest, `The digest ${digest.key}`);
    await writeAtomic(this.digestFile(valid.period, valid.key), serialise(valid));
  }

  private async scanDates(): Promise<IsoDate[]> {
    const dates: IsoDate[] = [];
    for (const year of await listDir(this.root, YEAR_DIR)) {
      for (const month of await listDir(path.join(this.root, year), MONTH_DIR)) {
        for (const file of await listDir(path.join(this.root, year, month), DAY_FILE)) {
          dates.push(`${year}-${month}-${file.slice(0, 2)}`);
        }
      }
    }
    return dates.sort().reverse();
  }

  private async writeIndex(): Promise<void> {
    // Rebuilt from the folders, not appended to, so a hand-deleted day leaves the index.
    const dates = await this.scanDates();
    await writeAtomic(path.join(this.root, INDEX_FILE), serialise({ dates }));
  }
}
