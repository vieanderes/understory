/**
 * Lecture PDFs. Run with `pnpm build:lectures` after `next build`; `postbuild` runs it too.
 *
 * Prints every lecture (each lesson, chapter and part, and the whole course) from its print
 * page, /print/lecture/<scope>, with Chromium, into public/pdf/<scope>.pdf. The print page
 * and its stylesheet are the PDF's design, so screen and paper cannot drift apart.
 *
 * A PDF is printed again only when what it is made of changes: the hashed bundle files of
 * its lessons, its capstone solution, or the source of the lecture views. The record is
 * public/pdf/index.json.
 *
 *   --base=<url>    print from a server that is already running (a dev server, say)
 *   --only=<keys>   comma-separated scope keys, for example chapter-js,lesson-js.closures
 *   --require       fail instead of skipping when no browser is installed
 *   --force         print everything again
 *
 * Without a browser (the Alpine image, CI before Playwright installs one) it prints nothing
 * and says so. The download button then opens the print page, where the browser's own
 * "Save as PDF" makes the same document.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import type { Manifest } from '../src/core/content/compiled';
import { TRACKS_DIR } from '../src/core/content/notes';
import { printPath, scopeKey, type LectureScope } from '../src/core/lecture/scope';
import { getJourneyParts } from '../src/lib/content/outline';
import { contentRoot } from '../src/lib/content/fs';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const ROOT = contentRoot();
const OUT = path.join(ROOT, 'public/pdf');
const RECORD = path.join(OUT, 'index.json');
const BUNDLE = path.join(ROOT, 'public/content/v1');
/** Pages printed at once. The course document alone holds every lesson, so keep it modest. */
const CONCURRENCY = 3;

/** The files whose change changes every PDF's look. */
const DESIGN_SOURCES = [
  'src/app/globals.css',
  'src/styles/tokens.css',
  'src/app/fonts.ts',
  'src/app/print/lecture/[scope]/page.tsx',
  'src/features/lecture',
  'src/core/lecture',
  'scripts/build-lectures.ts',
];

interface Job {
  scope: LectureScope;
  key: string;
  title: string;
  /** Hash of everything the PDF is made of. */
  inputs: string;
}

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);

function filesUnder(rel: string): string[] {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs
    .readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .sort();
}

function designHash(): string {
  return sha(
    DESIGN_SOURCES.flatMap(filesUnder)
      .map((file) => `${path.relative(ROOT, file)}\n${fs.readFileSync(file, 'utf8')}`)
      .join('\n'),
  );
}

/** The light-theme ink for the page footer, which Chromium renders outside the page's CSS. */
function footerColour(): string {
  const tokens = fs.readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8');
  return /--muted:\s*(#[0-9a-fA-F]{3,8})/.exec(tokens)?.[1] ?? 'grey';
}

async function plan(): Promise<Job[]> {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(BUNDLE, 'manifest.json'), 'utf8'),
  ) as Manifest;
  const design = designHash();
  const lessons = new Map(
    manifest.modules.flatMap((chapter) =>
      chapter.lessons.map((lesson) => [lesson.id, { lesson, chapter }] as const),
    ),
  );
  const lessonInput = (id: string) => {
    const found = lessons.get(id);
    return found ? `${found.lesson.file}|${found.lesson.lectureFile}` : id;
  };

  const jobs: Job[] = [];
  const add = (scope: LectureScope, title: string, parts: string[]) =>
    jobs.push({ scope, key: scopeKey(scope), title, inputs: sha([design, ...parts].join('\n')) });

  for (const [id, { lesson }] of lessons) {
    add({ kind: 'lesson', id }, lesson.title, [lessonInput(id)]);
  }

  const journey = await getJourneyParts();
  const chapterLessons = new Map<string, string[]>();
  for (const part of journey) {
    for (const chapter of part.chapters) {
      chapterLessons.set(
        chapter.id,
        chapter.lessons.filter((l) => l.href !== null).map((l) => l.id),
      );
    }
  }
  const inParts = new Set(manifest.parts.flatMap((part) => part.modules));
  for (const chapter of manifest.modules) {
    if (!inParts.has(chapter.id))
      chapterLessons.set(
        chapter.id,
        chapter.lessons.map((l) => l.id),
      );
  }
  for (const chapter of manifest.modules) {
    const ids = chapterLessons.get(chapter.id) ?? [];
    if (ids.length === 0) continue;
    add({ kind: 'chapter', id: chapter.id }, chapter.title, [
      chapter.title,
      chapter.why,
      chapter.summary,
      ...ids.map(lessonInput),
    ]);
  }

  const partInputs: string[] = [];
  manifest.parts.forEach((part, i) => {
    const ids = part.modules.flatMap((id) => chapterLessons.get(id) ?? []);
    const inputs = [
      part.title,
      part.summary,
      part.capstone.brief,
      part.capstone.solutionFile ?? '',
      ...ids.map(lessonInput),
    ];
    partInputs.push(...inputs);
    add(
      { kind: 'part', id: part.id },
      `Part ${String(i + 1).padStart(2, '0')}, ${part.title}`,
      inputs,
    );
  });
  add({ kind: 'course' }, manifest.course.title, [manifest.course.summary, ...partInputs]);

  const tracksDir = path.join(ROOT, TRACKS_DIR);
  const trackFiles = fs.existsSync(tracksDir)
    ? fs.readdirSync(tracksDir).filter((name) => name.endsWith('.yaml'))
    : [];
  for (const name of trackFiles) {
    const plan = fs.readFileSync(path.join(tracksDir, name), 'utf8');
    const ids = [...plan.matchAll(/[a-z][a-z0-9]*\.[a-z0-9]+(?:-[a-z0-9]+)*/g)].map((m) => m[0]);
    const title = /^title:\s*(.+)$/m.exec(plan)?.[1]?.trim() ?? name;
    add({ kind: 'track', id: name.replace(/\.yaml$/, '') }, title, [
      plan,
      ...ids.filter((id) => lessons.has(id)).map(lessonInput),
      ...manifest.parts.map((part) => part.capstone.solutionFile ?? ''),
      ...manifest.guides.map((guide) => guide.file),
    ]);
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// The server and the browser
// ---------------------------------------------------------------------------

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => resolve(typeof address === 'object' && address ? address.port : 3900));
    });
  });
}

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`The server at ${url} did not answer within ${timeoutMs / 1000} s.`);
}

async function startServer(): Promise<{ base: string; server: ChildProcess }> {
  const port = await freePort();
  const distDir = process.env.NEXT_DIST_DIR || '.next';
  if (!fs.existsSync(path.join(ROOT, distDir, 'BUILD_ID'))) {
    throw new Error(`No production build in ${distDir}. Run "pnpm build" first, or pass --base.`);
  }
  const server = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: ROOT,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  const base = `http://127.0.0.1:${port}`;
  await waitFor(`${base}/api/health`, 60_000);
  return { base, server };
}

async function launch(): Promise<Browser | undefined> {
  try {
    return await chromium.launch();
  } catch (error) {
    if (flag('require')) throw error;
    const first = String(error instanceof Error ? error.message : error).split('\n')[0];
    console.log(`build:lectures: no browser to print with, so no PDFs were made (${first}).`);
    console.log(
      '  Install one with "pnpm exec playwright install chromium" and run pnpm build:lectures.',
    );
    return undefined;
  }
}

async function printOne(browser: Browser, base: string, job: Job, colour: string): Promise<void> {
  const page = await browser.newPage();
  // The course document takes minutes to lay out; the default 30 s would cut it off.
  page.setDefaultTimeout(0);
  try {
    await page.emulateMedia({ media: 'print', colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto(`${base}${printPath(job.scope)}`, { waitUntil: 'load', timeout: 15 * 60_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const title = job.title.replace(/[<>&]/g, '');
    const target = path.join(OUT, `${job.key}.pdf`);
    await page.pdf({
      path: `${target}.part`,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      // Bookmarks need a tagged PDF, which is about 2.5 times the size. A single lesson is
      // short enough to scroll, so only chapters, parts and the course carry them.
      outline: job.scope.kind !== 'lesson',
      tagged: job.scope.kind !== 'lesson',
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;padding:0 14mm;display:flex;justify-content:space-between;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:7px;letter-spacing:0.06em;color:${colour}"><span>UNDERSTORY · ${title.toUpperCase()}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    // Renamed into place, so a half-written file is never served.
    fs.renameSync(`${target}.part`, target);
  } finally {
    await page.close();
  }
}

async function main(): Promise<number> {
  if (process.env.LECTURE_PDFS === '0') {
    console.log('build:lectures: skipped (LECTURE_PDFS=0).');
    return 0;
  }
  const only = option('only')?.split(',').filter(Boolean);
  const record: Record<string, string> =
    !flag('force') && fs.existsSync(RECORD)
      ? (JSON.parse(fs.readFileSync(RECORD, 'utf8')) as Record<string, string>)
      : {};
  const jobs = (await plan()).filter((job) => !only || only.includes(job.key));
  const stale = jobs.filter(
    (job) => record[job.key] !== job.inputs || !fs.existsSync(path.join(OUT, `${job.key}.pdf`)),
  );
  if (stale.length === 0) {
    console.log(`build:lectures: all ${jobs.length} PDFs are up to date.`);
    return 0;
  }

  const browser = await launch();
  if (!browser) return 0;
  fs.mkdirSync(OUT, { recursive: true });
  const given = option('base');
  const started = given ? undefined : await startServer();
  const base = given ?? started?.base ?? '';
  const colour = footerColour();

  // Longest first, so the course document is not the last thing left running on its own.
  const queue = [...stale].sort((a, b) => weight(b) - weight(a));
  let done = 0;
  const began = Date.now();
  try {
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let job = queue.shift(); job; job = queue.shift()) {
          await printOne(browser, base, job, colour);
          record[job.key] = job.inputs;
          done += 1;
          if (done % 25 === 0 || job.scope.kind !== 'lesson') {
            console.log(`  ${done}/${stale.length} ${job.key}`);
          }
        }
      }),
    );
  } finally {
    fs.writeFileSync(RECORD, `${JSON.stringify(record, null, 2)}\n`);
    await browser.close();
    started?.server.kill();
  }
  const seconds = Math.round((Date.now() - began) / 1000);
  console.log(`build:lectures: printed ${done} of ${jobs.length} PDFs in ${seconds} s.`);
  return 0;
}

const weight = (job: Job): number =>
  ({ course: 4, part: 3, track: 3, chapter: 2, lesson: 1 })[job.scope.kind];

// No top-level await: the repo is CommonJS by default, and tsx runs this file as such.
void main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
