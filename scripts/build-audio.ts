/**
 * Lecture audio. Run with `pnpm build:audio`. Needs macOS on Apple Silicon, uv and ffmpeg.
 *
 * Writes every lesson lecture as a script to read aloud (src/core/lecture/speech.ts), reads
 * the new and changed ones with Kokoro (scripts/audio/kokoro.py) into
 * public/audio/lesson/<id>.m4a, then writes a playlist for every lesson, chapter, part and
 * the course, and for each fast track whose audio exists: public/audio/<scope>.json.
 * The lecture pages play whatever playlist exists; everything else stays silent.
 *
 * Lessons of the fast tracks are read first, in track order, then the rest in course order.
 * A lesson is read again only when its script changes. An interrupted run resumes.
 *
 *   --index        only rewrite the playlists
 *   --texts        only write the scripts, to .cache/audio (to read them or count words)
 *   --only=<ids>   comma-separated lesson ids
 *   --voice=<id>   a Kokoro voice (default bf_emma, British English)
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { lessonScript, scopeKey, type AudioPlaylist, type LectureScope } from '../src/core/lecture';
import { contentRoot } from '../src/lib/content/fs';
import { getLectureIndex, getLessonLecture } from '../src/lib/content/lectures';

const args = process.argv.slice(2);
const option = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const ROOT = contentRoot();
const OUT = path.join(ROOT, 'public/audio');
const CACHE = path.join(ROOT, '.cache/audio');
const RECORD = path.join(OUT, 'record.json');

type Record = { [id: string]: { hash: string; seconds: number } };

const sha = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const readRecord = (): Record =>
  fs.existsSync(RECORD) ? (JSON.parse(fs.readFileSync(RECORD, 'utf8')) as Record) : {};

/** Lesson ids in the order to read them: the fast tracks first, then the course. */
async function readingOrder(): Promise<{ id: string; context: string }[]> {
  const index = await getLectureIndex();
  const chapters = [...index.parts.flatMap((part) => part.chapters), ...index.woven];
  const context = new Map<string, string>();
  for (const chapter of chapters) {
    chapter.lessonIds.forEach((id, i) => {
      if (!context.has(id)) context.set(id, `${chapter.title}, lesson ${i + 1}`);
    });
  }
  const tracksDir = path.join(ROOT, 'content/tracks');
  const fromTracks = fs.existsSync(tracksDir)
    ? fs
        .readdirSync(tracksDir)
        .filter((name) => name.endsWith('.yaml'))
        .sort()
        .flatMap((name) => {
          const plan = parse(fs.readFileSync(path.join(tracksDir, name), 'utf8')) as {
            days: { must: string[]; should?: string[] }[];
          };
          return plan.days.flatMap((day) => [...day.must, ...(day.should ?? [])]);
        })
    : [];
  const ordered = [...new Set([...fromTracks, ...chapters.flatMap((c) => c.lessonIds)])];
  return ordered
    .filter((id) => context.has(id))
    .map((id) => ({ id, context: context.get(id) ?? '' }));
}

async function speak(voice: string, only: string[] | undefined): Promise<void> {
  const record = readRecord();
  const queue: { id: string; text: string; out: string; hash: string }[] = [];
  fs.mkdirSync(path.join(CACHE, 'lesson'), { recursive: true });
  for (const { id, context } of await readingOrder()) {
    if (only && !only.includes(id)) continue;
    const lecture = await getLessonLecture(id);
    if (!lecture) continue;
    const script = lessonScript(lecture, context);
    const hash = sha(`${voice}\n${script}`);
    const out = path.join(OUT, 'lesson', `${id}.m4a`);
    const text = path.join(CACHE, 'lesson', `${id}.txt`);
    fs.writeFileSync(text, script);
    if (record[id]?.hash === hash && fs.existsSync(out)) continue;
    queue.push({ id, text, out, hash });
  }
  if (args.includes('--texts')) {
    console.log(`build:audio: wrote scripts, ${queue.length} lessons would be read.`);
    process.exit(0);
  }
  if (queue.length === 0) {
    console.log('build:audio: every lesson is up to date.');
    return;
  }
  console.log(`build:audio: reading ${queue.length} lessons aloud with ${voice}.`);
  const queueFile = path.join(CACHE, 'queue.json');
  fs.writeFileSync(queueFile, JSON.stringify(queue));
  fs.mkdirSync(OUT, { recursive: true });
  const run = spawnSync(
    'uv',
    [
      'run',
      '--quiet',
      '--python',
      '3.12',
      '--with',
      'mlx-audio',
      '--with',
      'misaki[en]',
      '--with',
      'soundfile',
      'python',
      path.join(ROOT, 'scripts/audio/kokoro.py'),
      queueFile,
      RECORD,
      voice,
    ],
    { stdio: 'inherit' },
  );
  if (run.status !== 0) throw new Error('Kokoro stopped. Run pnpm build:audio again to resume.');
}

/**
 * The playlist as one audiobook: its m4a files joined into an m4b with a chapter per item.
 * The audio is copied, not encoded again, so this takes seconds even for a part. Rebuilt only
 * when the items change.
 */
function book(scope: LectureScope, playlist: AudioPlaylist): AudioPlaylist['book'] {
  const first = playlist.items[0];
  if (!first) return undefined;
  const fileOf = (src: string) => path.join(OUT, src.replace(/^\/audio\//, ''));
  if (scope.kind === 'lesson') {
    return { src: first.src, bytes: fs.statSync(fileOf(first.src)).size };
  }
  const dir = path.join(OUT, 'book');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${scopeKey(scope)}.m4b`);
  const stamp = `${target}.hash`;
  const hash = sha(playlist.items.map((item) => `${item.src}:${item.seconds}`).join('\n'));
  const fresh =
    fs.existsSync(target) && fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === hash;
  if (!fresh) {
    const list = `${target}.txt`;
    fs.writeFileSync(list, playlist.items.map((item) => `file '${fileOf(item.src)}'\n`).join(''));
    const meta = [
      ';FFMETADATA1',
      `title=${playlist.title}`,
      'artist=Understory',
      'genre=Audiobook',
    ];
    let start = 0;
    for (const item of playlist.items) {
      const end = start + item.seconds * 1000;
      meta.push(
        '[CHAPTER]',
        'TIMEBASE=1/1000',
        `START=${start}`,
        `END=${end}`,
        `title=${item.title.replace(/[=;#\\]/g, ' ')}`,
      );
      start = end;
    }
    fs.writeFileSync(`${target}.ffmeta`, `${meta.join('\n')}\n`);
    const run = spawnSync(
      'ffmpeg',
      [
        '-loglevel',
        'error',
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        list,
        '-i',
        `${target}.ffmeta`,
        '-map',
        '0:a',
        '-map_metadata',
        '1',
        '-map_chapters',
        '1',
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        `${target}.part`,
      ],
      { stdio: 'inherit' },
    );
    fs.rmSync(list);
    fs.rmSync(`${target}.ffmeta`);
    if (run.status !== 0) return undefined;
    fs.renameSync(`${target}.part`, target);
    fs.writeFileSync(stamp, hash);
  }
  return { src: `/audio/book/${scopeKey(scope)}.m4b`, bytes: fs.statSync(target).size };
}

function write(scope: LectureScope, playlist: AudioPlaylist): void {
  if (playlist.items.length === 0) return;
  const whole = book(scope, playlist);
  fs.writeFileSync(
    path.join(OUT, `${scopeKey(scope)}.json`),
    JSON.stringify(whole ? { ...playlist, book: whole } : playlist),
  );
}

/** A playlist for every lesson, chapter, part, the course and each track with audio. */
async function writePlaylists(): Promise<number> {
  const record = readRecord();
  fs.mkdirSync(OUT, { recursive: true });
  for (const stale of fs
    .readdirSync(OUT)
    .filter((name) => name.endsWith('.json') && name !== 'record.json')) {
    fs.rmSync(path.join(OUT, stale));
  }
  const index = await getLectureIndex();
  const item = async (id: string) => {
    const seconds = record[id]?.seconds;
    if (seconds === undefined || !fs.existsSync(path.join(OUT, 'lesson', `${id}.m4a`))) return [];
    const lecture = await getLessonLecture(id);
    return lecture ? [{ title: lecture.title, src: `/audio/lesson/${id}.m4a`, seconds }] : [];
  };
  const items = async (ids: readonly string[]) => (await Promise.all(ids.map(item))).flat();

  let written = 0;
  const course: AudioPlaylist['items'] = [];
  const chapters = [...index.parts.flatMap((part) => part.chapters), ...index.woven];
  for (const chapter of chapters) {
    for (const id of chapter.lessonIds) {
      const lesson = await items([id]);
      if (lesson.length > 0) {
        write({ kind: 'lesson', id }, { title: lesson[0]?.title ?? id, items: lesson });
        written += 1;
      }
    }
    write(
      { kind: 'chapter', id: chapter.id },
      { title: chapter.title, items: await items(chapter.lessonIds) },
    );
  }
  for (const part of index.parts) {
    const partItems = await items(part.chapters.flatMap((chapter) => chapter.lessonIds));
    write({ kind: 'part', id: part.id }, { title: part.title, items: partItems });
    course.push(...partItems);
  }
  write({ kind: 'course' }, { title: index.title, items: course });

  // A fast track is read as its own condensed script (one file per section), in its folder.
  const tracks = path.join(OUT, 'track');
  if (fs.existsSync(tracks)) {
    for (const id of fs.readdirSync(tracks)) {
      const titles = path.join(tracks, id, 'playlist.json');
      if (fs.existsSync(titles)) {
        write({ kind: 'track', id }, JSON.parse(fs.readFileSync(titles, 'utf8')) as AudioPlaylist);
      }
    }
  }
  return written;
}

async function main(): Promise<number> {
  if (!args.includes('--index')) {
    await speak(option('voice') ?? 'bf_emma', option('only')?.split(',').filter(Boolean));
  }
  const lessons = await writePlaylists();
  console.log(`build:audio: playlists written, ${lessons} lessons have audio.`);
  return 0;
}

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
