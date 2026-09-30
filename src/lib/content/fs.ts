/**
 * Node-side file access for `content/`. Build time and scripts only, never the browser.
 *
 * Two ways in:
 *  - `readYaml` throws a `ContentError`, for callers that cannot continue without the file
 *  - `loadRawCatalog` never throws on bad content. It returns what it could read plus a
 *    list of issues, so the validator can show every problem in one run
 */
import fs from 'node:fs';
import path from 'node:path';
import { LineCounter, parseDocument } from 'yaml';
import type { Document } from 'yaml';
import type { z } from 'zod';
import { COURSE_DIR, COURSE_PATH, LOCK_PATH } from '@/core/content/catalog';
import type {
  IdsLock,
  Issue,
  RawCatalog,
  RawCourse,
  RawLesson,
  RawModule,
} from '@/core/content/catalog';
import { idsLockSchema } from '@/core/content/lock';
import {
  CAPSTONES_DIR,
  capstoneSolutionSchema,
  fastTrackSchema,
  GUIDES_DIR,
  guideSchema,
  lessonNotesSchema,
  NOTES_FILE,
  TRACKS_DIR,
} from '@/core/content/notes';
import type { CapstoneSolution, FastTrack, Guide } from '@/core/content/notes';
import { courseSchema, lessonSchema, moduleSchema } from '@/core/content/schema';
import type { Lesson } from '@/core/content/schema';
import { challengeFileNames, isSafeFileName } from '@/core/content/validate';

/** `CONTENT_ROOT` lets tests point every reader at a temporary copy of the repo. */
export const contentRoot = (): string => process.env.CONTENT_ROOT ?? process.cwd();

export const CONTENT_DIR = path.join(contentRoot(), 'content');

/** Thrown for a content problem. The message is written for the author of the file. */
export class ContentError extends Error {
  constructor(
    public readonly file: string,
    message: string,
  ) {
    super(`${file}\n  ${message}`);
    this.name = 'ContentError';
  }
}

const posix = (p: string): string => p.split(path.sep).join('/');

// ---------------------------------------------------------------------------
// The NN-slug convention
// ---------------------------------------------------------------------------

const NUMBERED = /^(\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export interface Numbered {
  order: number;
  slug: string;
}

/** `03-javascript` gives order 3 and slug `javascript`. The slug is the URL segment. */
export function parseNumbered(name: string): Numbered | undefined {
  const match = NUMBERED.exec(name);
  const [, order, slug] = match ?? [];
  return order !== undefined && slug !== undefined ? { order: Number(order), slug } : undefined;
}

export interface NumberedDir extends Numbered {
  name: string;
  /** Repo-relative, forward slashes. */
  rel: string;
}

const subfolders = (abs: string): string[] =>
  fs.existsSync(abs)
    ? fs
        .readdirSync(abs, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)
        .sort()
    : [];

/** Numbered subfolders in order, plus an issue for each folder that breaks the convention. */
export function listNumbered(
  root: string,
  relDir: string,
): { entries: NumberedDir[]; issues: Issue[] } {
  const entries: NumberedDir[] = [];
  const issues: Issue[] = [];
  for (const name of subfolders(path.join(root, relDir))) {
    const parsed = parseNumbered(name);
    const rel = `${relDir}/${name}`;
    if (parsed) entries.push({ ...parsed, name, rel });
    else {
      issues.push({
        severity: 'error',
        rule: 'folder-name',
        path: rel,
        message:
          'A folder here is named with a two-digit number, a hyphen and lowercase words, for example "03-javascript". Rename it, or move it out of content/.',
      });
    }
  }
  return { entries, issues };
}

// ---------------------------------------------------------------------------
// Schema issues in plain English
// ---------------------------------------------------------------------------

export interface DescribedIssue {
  /** `steps → 3 (predict-total) → choices`. Empty for the top of the file. */
  where: string;
  message: string;
  /** The raw path, for looking up a line number. */
  path: PropertyKey[];
}

interface SchemaContext {
  schema: z.ZodType;
  /** The input that failed. It picks the branch of a union and names list entries. */
  data?: unknown;
}

type Def = { type: string } & Record<string, unknown>;
const defOf = (schema: unknown): Def | undefined => {
  const def = (schema as { def?: unknown } | undefined)?.def;
  return typeof def === 'object' && def !== null && 'type' in def ? (def as Def) : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const childOf = (data: unknown, key: PropertyKey): unknown =>
  Array.isArray(data) && typeof key === 'number'
    ? data[key]
    : isRecord(data) && typeof key === 'string'
      ? data[key]
      : undefined;

/** Steps through wrappers (optional, default) that carry no key of their own. */
function unwrap(schema: unknown): unknown {
  const def = defOf(schema);
  return def && 'innerType' in def ? unwrap(def.innerType) : schema;
}

/** The schema one key further down, choosing the union branch that the data asks for. */
function stepInto(schema: unknown, key: PropertyKey, data: unknown): unknown {
  const inner = unwrap(schema);
  const def = defOf(inner);
  if (!def) return undefined;
  if (def.type === 'array') return def.element;
  if (def.type === 'object' && isRecord(def.shape) && typeof key === 'string') return def.shape[key];
  if (def.type === 'union' && Array.isArray(def.options)) {
    const discriminator = typeof def.discriminator === 'string' ? def.discriminator : 'type';
    const wanted = childOf(data, discriminator);
    const option = def.options.find((candidate) => {
      const shape = defOf(candidate)?.shape;
      const values = isRecord(shape) ? defOf(shape[discriminator])?.values : undefined;
      return Array.isArray(values) && values.includes(wanted);
    });
    return stepInto(option, key, data);
  }
  return undefined;
}

function schemaAt(context: SchemaContext | undefined, keys: readonly PropertyKey[]): unknown {
  let schema: unknown = context?.schema;
  let data: unknown = context?.data;
  for (const key of keys) {
    schema = stepInto(schema, key, data);
    data = childOf(data, key);
  }
  return schema;
}

function hintAt(context: SchemaContext | undefined, keys: readonly PropertyKey[]): string {
  const schema = schemaAt(context, keys) as { description?: string } | undefined;
  return schema?.description ?? (unwrap(schema) as { description?: string } | undefined)?.description ?? '';
}

function allowedKeysAt(context: SchemaContext | undefined, keys: readonly PropertyKey[]): string[] {
  const shape = defOf(unwrap(schemaAt(context, keys)))?.shape;
  return isRecord(shape) ? Object.keys(shape) : [];
}

/** `steps → 2 (predict-total) → question`. List positions count from 1, as people do. */
function wherePath(keys: readonly PropertyKey[], data: unknown): string {
  const parts: string[] = [];
  let cursor = data;
  for (const key of keys) {
    cursor = childOf(cursor, key);
    const id = isRecord(cursor) && typeof cursor.id === 'string' ? ` (${cursor.id})` : '';
    parts.push(typeof key === 'number' ? `${key + 1}${id}` : String(key));
  }
  return parts.join(' → ');
}

const quoted = (values: readonly unknown[]): string => values.map((v) => `"${String(v)}"`).join(', ');
const withHint = (message: string, hint: string): string =>
  hint && !message.includes(hint) ? `${message} ${hint}` : message;

const UNITS: Record<string, string> = { array: 'entries', string: 'characters', set: 'entries' };

function sizeMessage(issue: z.core.$ZodIssueTooSmall | z.core.$ZodIssueTooBig, name: string): string {
  const bound = issue.code === 'too_small' ? `at least ${issue.minimum}` : `at most ${issue.maximum}`;
  const unit = UNITS[issue.origin];
  return unit ? `${name} needs ${bound} ${unit}.` : `${name} must be ${bound}.`;
}

function messageFor(issue: z.core.$ZodIssue, context: SchemaContext | undefined): string {
  const last = issue.path.at(-1);
  const name = typeof last === 'number' ? `Entry ${last + 1}` : `"${String(last ?? 'The file')}"`;
  const hint = hintAt(context, issue.path);
  switch (issue.code) {
    case 'unrecognized_keys': {
      const allowed = allowedKeysAt(context, issue.path);
      const list = allowed.length > 0 ? ` Keys allowed here: ${allowed.join(', ')}.` : '';
      return `Unknown key ${quoted(issue.keys)}. Check the spelling.${list}`;
    }
    case 'invalid_type':
      return issue.message.endsWith('received undefined')
        ? withHint(`Missing ${name}.`, hint)
        : withHint(`${name} must be ${/^[aeiou]/.test(issue.expected) ? 'an' : 'a'} ${issue.expected}.`, hint);
    case 'invalid_union':
      return 'options' in issue && Array.isArray(issue.options)
        ? `${name} must be one of: ${issue.options.join(', ')}.`
        : withHint(`${name} is not valid.`, hint);
    case 'invalid_value':
      return withHint(`${name} must be one of: ${quoted(issue.values)}.`, hint);
    case 'too_small':
    case 'too_big':
      // A custom message in the schema is already written for authors.
      return /^Too (small|big)/.test(issue.message) ? withHint(sizeMessage(issue, name), hint) : issue.message;
    default:
      return withHint(issue.message, hint);
  }
}

/** Turns zod issues into sentences an author can act on, using the `.describe()` hints. */
export function describeIssues(
  issues: readonly z.core.$ZodIssue[],
  context?: SchemaContext,
): DescribedIssue[] {
  return issues.map((issue) => ({
    where: wherePath(issue.path, context?.data),
    message: messageFor(issue, context),
    path: [...issue.path],
  }));
}

// ---------------------------------------------------------------------------
// YAML
// ---------------------------------------------------------------------------

/** What the parser's error codes mean for someone who does not read parser errors. */
const YAML_ADVICE: Record<string, string> = {
  BAD_INDENT: 'The indentation is off. Entries of one list or block start in the same column.',
  TAB_AS_INDENT: 'This line is indented with a tab. YAML allows spaces only.',
  DUPLICATE_KEY: 'The same key appears twice in one block. Remove or rename one.',
  MISSING_CHAR: 'A quote or bracket is not closed, or a list entry has lost its "-".',
  BLOCK_AS_IMPLICIT_KEY:
    'The text contains a colon followed by a space. Put the whole value in quotes.',
  MULTILINE_IMPLICIT_KEY:
    'A value runs over several lines. Put it in quotes, or use a block with "|".',
  UNEXPECTED_TOKEN: 'Something does not belong here. Check the quotes and the indentation.',
};

interface ParsedFile<T> {
  data?: T;
  issues: Issue[];
}

function lineOf(doc: Document, counter: LineCounter, keys: readonly PropertyKey[]): number | undefined {
  // A missing key has no node, so fall back to the block that should hold it.
  for (let depth = keys.length; depth >= 0; depth -= 1) {
    const node = doc.getIn(keys.slice(0, depth), true) as { range?: [number, number, number] } | undefined;
    if (node?.range) return counter.linePos(node.range[0]).line;
  }
  return undefined;
}

function parseText<T>(text: string, rel: string, schema: z.ZodType<T>): ParsedFile<T> {
  const counter = new LineCounter();
  const doc = parseDocument(text, { lineCounter: counter, prettyErrors: true });
  if (doc.errors.length > 0) {
    return {
      issues: doc.errors.map((error) => ({
        severity: 'error',
        rule: 'yaml-syntax',
        path: rel,
        where: `line ${error.linePos?.[0].line ?? 1}`,
        message: YAML_ADVICE[error.code] ?? `The YAML could not be read: ${error.message.split('\n')[0]}`,
      })),
    };
  }
  const data: unknown = doc.toJS() ?? {};
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data, issues: [] };
  return {
    issues: describeIssues(result.error.issues, { schema, data }).map((described) => {
      const line = lineOf(doc, counter, described.path);
      const where = [line === undefined ? '' : `line ${line}`, described.where].filter(Boolean);
      return {
        severity: 'error',
        rule: 'schema',
        path: rel,
        ...(where.length > 0 ? { where: where.join(', ') } : {}),
        message: described.message,
      };
    }),
  };
}

const missing = (rel: string, what: string): Issue => ({
  severity: 'error',
  rule: 'file-missing',
  path: rel,
  message: `${what} is missing. Create it. docs/CONTENT-GUIDE.md shows what goes in it.`,
});

function parseFile<T>(root: string, rel: string, schema: z.ZodType<T>, what: string): ParsedFile<T> {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return { issues: [missing(rel, what)] };
  return parseText(fs.readFileSync(abs, 'utf8'), rel, schema);
}

/** Reads one YAML file under `content/`. Throws a `ContentError` on any problem. */
export function readYaml<T>(relPath: string, schema: z.ZodType<T>, root = contentRoot()): T {
  const rel = posix(path.join('content', relPath));
  const { data, issues } = parseFile(root, rel, schema, 'This file');
  if (data === undefined) {
    const lines = issues.map((issue) => [issue.where, issue.message].filter(Boolean).join(': '));
    throw new ContentError(rel, lines.join('\n  '));
  }
  return data;
}

// ---------------------------------------------------------------------------
// The catalog
// ---------------------------------------------------------------------------

export interface LoadedCatalog {
  catalog: RawCatalog;
  /** Read and schema problems. Files that have one are left out of the catalog. */
  issues: Issue[];
  /** How many YAML files were looked at, for the summary line. */
  checked: number;
}

/** Collects issues and counts files while the tree is walked, to keep signatures short. */
class Reading {
  readonly issues: Issue[] = [];
  checked = 0;

  constructor(readonly root: string) {}

  yaml<T>(rel: string, schema: z.ZodType<T>, what: string): T | undefined {
    const { data, issues } = parseFile(this.root, rel, schema, what);
    if (fs.existsSync(path.join(this.root, rel))) this.checked += 1;
    this.issues.push(...issues);
    return data;
  }

  numbered(relDir: string): NumberedDir[] {
    const { entries, issues } = listNumbered(this.root, relDir);
    this.issues.push(...issues);
    return entries;
  }
}

function challengeFiles(root: string, relDir: string, lesson: Lesson): Record<string, string> {
  const names = lesson.steps.flatMap((step) =>
    step.type === 'code-challenge' ? challengeFileNames(step) : [],
  );
  const files: Record<string, string> = {};
  // A name with a slash or ".." could reach outside the lesson. The validator reports it.
  for (const name of names.filter(isSafeFileName)) {
    const abs = path.join(root, relDir, name);
    if (fs.existsSync(abs)) files[name] = fs.readFileSync(abs, 'utf8');
  }
  return files;
}

function readLesson(reading: Reading, dir: NumberedDir): RawLesson[] {
  const rel = `${dir.rel}/lesson.yaml`;
  const data = reading.yaml(rel, lessonSchema, 'The lesson file lesson.yaml');
  if (!data) return [];
  const files = challengeFiles(reading.root, dir.rel, data);
  // Notes are optional: a lesson without them still has a lecture, built from its steps.
  const notesRel = `${dir.rel}/${NOTES_FILE}`;
  const notes = fs.existsSync(path.join(reading.root, notesRel))
    ? reading.yaml(notesRel, lessonNotesSchema, 'The lecture notes notes.yaml')
    : undefined;
  return [
    {
      path: rel,
      slug: dir.slug,
      order: dir.order,
      data,
      files,
      ...(notes ? { notes: { path: notesRel, data: notes } } : {}),
    },
  ];
}

function readModule(reading: Reading, dir: NumberedDir): RawModule[] {
  const rel = `${dir.rel}/module.yaml`;
  const data = reading.yaml(rel, moduleSchema, 'The module file module.yaml');
  // Lessons are still read when the module is broken, so their problems show in the same run.
  const lessons = reading.numbered(dir.rel).flatMap((lessonDir) => readLesson(reading, lessonDir));
  return data ? [{ path: rel, slug: dir.slug, order: dir.order, data, lessons }] : [];
}

function readCourse(reading: Reading): RawCourse | undefined {
  const data = reading.yaml(COURSE_PATH, courseSchema, 'The course file course.yaml');
  // Modules are still read when course.yaml is broken, so their problems show in the same run.
  const modules = reading.numbered(COURSE_DIR).flatMap((dir) => readModule(reading, dir));
  const capstones = readCapstones(reading);
  const guides = readDir(reading, GUIDES_DIR, guideSchema, 'The guide');
  return data ? { path: COURSE_PATH, data, modules, capstones, guides } : undefined;
}

/** `content/capstones/<partId>.yaml`, keyed by part id. The validator matches them to parts. */
function readCapstones(reading: Reading): Record<string, { path: string; data: CapstoneSolution }> {
  const dir = path.join(reading.root, CAPSTONES_DIR);
  if (!fs.existsSync(dir)) return {};
  const found: Record<string, { path: string; data: CapstoneSolution }> = {};
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.yaml')).sort()) {
    const rel = `${CAPSTONES_DIR}/${name}`;
    const data = reading.yaml(rel, capstoneSolutionSchema, 'The capstone solution');
    if (data) found[name.replace(/\.yaml$/, '')] = { path: rel, data };
  }
  return found;
}

function readLock(reading: Reading): IdsLock | undefined {
  const abs = path.join(reading.root, LOCK_PATH);
  if (!fs.existsSync(abs)) return undefined;
  try {
    return idsLockSchema.parse(JSON.parse(fs.readFileSync(abs, 'utf8')));
  } catch {
    reading.issues.push({
      severity: 'error',
      rule: 'lock-unreadable',
      path: LOCK_PATH,
      message:
        'The ids lock cannot be read. Restore it from git. Do not delete it: it is the record of every id learners have progress under.',
    });
    return undefined;
  }
}

export function loadRawCatalog(root = contentRoot()): LoadedCatalog {
  const reading = new Reading(root);
  if (!fs.existsSync(path.join(root, COURSE_DIR))) {
    return {
      catalog: {},
      issues: [missing(COURSE_DIR, `The folder ${COURSE_DIR}`)],
      checked: 0,
    };
  }
  const course = readCourse(reading);
  const lock = readLock(reading);
  return {
    catalog: { ...(course ? { course } : {}), ...(lock ? { lock } : {}) },
    issues: reading.issues,
    checked: reading.checked,
  };
}

/** Every `<id>.yaml` in a folder, keyed by id. A missing folder holds nothing. */
function readDir<T>(
  reading: Reading,
  relDir: string,
  schema: z.ZodType<T>,
  what: string,
): Record<string, { path: string; data: T }> {
  const dir = path.join(reading.root, relDir);
  if (!fs.existsSync(dir)) return {};
  const found: Record<string, { path: string; data: T }> = {};
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.yaml')).sort()) {
    const rel = `${relDir}/${name}`;
    const data = reading.yaml(rel, schema, what);
    if (data) found[name.replace(/\.yaml$/, '')] = { path: rel, data };
  }
  return found;
}

export interface LoadedTracks {
  tracks: Record<string, { path: string; data: FastTrack }>;
  issues: Issue[];
}

/** The fast tracks in `content/tracks/`, keyed by id. A course needs none. */
export function loadTracks(root = contentRoot()): LoadedTracks {
  const reading = new Reading(root);
  const tracks = readDir(reading, TRACKS_DIR, fastTrackSchema, 'The fast track');
  return { tracks, issues: reading.issues };
}

export type { Guide };
