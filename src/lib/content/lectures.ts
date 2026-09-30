/**
 * Lectures for server components: a lesson, a chapter, a part or the whole course, as
 * reading. The journey decides the order, so a lecture reads the course the way the Learn
 * page lays it out, with woven lessons where they are taught.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CompiledCapstoneSolution, CompiledGuide } from '@/core/content/compiled';
import { fastTrackSchema, TRACKS_DIR, type FastTrack } from '@/core/content/notes';
import { buildLessonLecture, readingWords, type LessonLecture } from '@/core/lecture';
import { contentRoot, readYaml } from './fs';
import {
  getCapstoneSolution,
  getCourse,
  getGuide,
  getLectureExtras,
  getLesson,
  getManifest,
} from './loaders';
import { getJourneyParts } from './outline';

export interface LectureChapter {
  id: string;
  number: number;
  slug: string;
  title: string;
  summary: string;
  why: string;
  youCanBuild: string;
  /** The part the chapter is in. Woven chapters are in none. */
  part?: { id: string; number: number; title: string };
  /** Published lessons only, in reading order. */
  lessonIds: string[];
}

export interface LecturePart {
  id: string;
  number: number;
  title: string;
  summary: string;
  capstone: { title: string; brief: string; hasSolution: boolean };
  chapters: LectureChapter[];
}

export interface LectureIndex {
  title: string;
  summary: string;
  parts: LecturePart[];
  /** Chapters woven into others (CS fundamentals, clean code), read on their own. */
  woven: LectureChapter[];
}

/** The course as a reading plan: parts, chapters and published lesson ids. */
export async function getLectureIndex(): Promise<LectureIndex> {
  const [course, manifest, journey] = await Promise.all([
    getCourse(),
    getManifest(),
    getJourneyParts(),
  ]);
  const parts: LecturePart[] = journey.map((part) => ({
    id: part.id,
    number: part.number,
    title: part.title,
    summary: part.summary,
    capstone: {
      ...part.capstone,
      hasSolution:
        manifest.parts.find((p) => p.id === part.id)?.capstone.solutionFile !== undefined,
    },
    chapters: part.chapters.map((chapter) => ({
      id: chapter.id,
      number: chapter.number,
      slug: chapter.slug,
      title: chapter.title,
      summary: chapter.summary,
      why: chapter.why,
      youCanBuild: chapter.youCanBuild,
      part: { id: part.id, number: part.number, title: part.title },
      lessonIds: chapter.lessons.filter((l) => l.href !== null).map((l) => l.id),
    })),
  }));
  const inParts = new Set(manifest.parts.flatMap((part) => part.modules));
  const woven = manifest.modules
    .filter((module) => !inParts.has(module.id) && module.lessons.length > 0)
    .map((module) => ({
      id: module.id,
      number: module.number,
      slug: module.slug,
      title: module.title,
      summary: module.summary,
      why: module.why,
      youCanBuild: module.youCanBuild,
      lessonIds: module.lessons.map((lesson) => lesson.id),
    }));
  return { title: course.title, summary: course.summary, parts, woven };
}

export async function getLessonLecture(lessonId: string): Promise<LessonLecture | undefined> {
  const [lesson, extras] = await Promise.all([getLesson(lessonId), getLectureExtras(lessonId)]);
  return lesson ? buildLessonLecture(lesson, extras) : undefined;
}

async function lessonsOf(ids: readonly string[]): Promise<LessonLecture[]> {
  const lectures = await Promise.all(ids.map((id) => getLessonLecture(id)));
  return lectures.filter((lecture): lecture is LessonLecture => lecture !== undefined);
}

const allChapters = (index: LectureIndex): LectureChapter[] => [
  ...index.parts.flatMap((part) => part.chapters),
  ...index.woven,
];

/** `id` is a module id or its URL slug. */
export async function findLectureChapter(id: string): Promise<LectureChapter | undefined> {
  return allChapters(await getLectureIndex()).find(
    (chapter) => chapter.id === id || chapter.slug === id,
  );
}

export interface ChapterLecture {
  chapter: LectureChapter;
  lessons: LessonLecture[];
  readingMinutes: number;
  previous?: LectureChapter;
  next?: LectureChapter;
}

const minutesOf = (lessons: readonly LessonLecture[]): number =>
  lessons.reduce((sum, lesson) => sum + lesson.readingMinutes, 0);

export async function getChapterLecture(id: string): Promise<ChapterLecture | undefined> {
  const index = await getLectureIndex();
  const chapters = allChapters(index);
  const at = chapters.findIndex((chapter) => chapter.id === id || chapter.slug === id);
  const chapter = chapters[at];
  if (!chapter) return undefined;
  const lessons = await lessonsOf(chapter.lessonIds);
  const previous = chapters[at - 1];
  const next = chapters[at + 1];
  return {
    chapter,
    lessons,
    readingMinutes: minutesOf(lessons),
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  };
}

export interface PartLecture {
  part: LecturePart;
  chapters: { chapter: LectureChapter; lessons: LessonLecture[]; readingMinutes: number }[];
  solution?: CompiledCapstoneSolution;
  readingMinutes: number;
}

export async function getPartLecture(partId: string): Promise<PartLecture | undefined> {
  const part = (await getLectureIndex()).parts.find((p) => p.id === partId);
  if (!part) return undefined;
  const [chapters, solution] = await Promise.all([
    Promise.all(
      part.chapters.map(async (chapter) => {
        const lessons = await lessonsOf(chapter.lessonIds);
        return { chapter, lessons, readingMinutes: minutesOf(lessons) };
      }),
    ),
    getCapstoneSolution(part.id),
  ]);
  return {
    part,
    chapters,
    ...(solution ? { solution } : {}),
    readingMinutes: chapters.reduce((sum, chapter) => sum + chapter.readingMinutes, 0),
  };
}

/** Reading minutes per chapter and part, for the index, without holding every lecture. */
export async function getLectureTimes(): Promise<Map<string, number>> {
  const index = await getLectureIndex();
  const times = new Map<string, number>();
  for (const chapter of allChapters(index)) {
    let minutes = 0;
    for (const id of chapter.lessonIds) {
      const lecture = await getLessonLecture(id);
      minutes += lecture?.readingMinutes ?? 0;
    }
    times.set(`chapter-${chapter.id}`, minutes);
  }
  for (const part of index.parts) {
    times.set(
      `part-${part.id}`,
      part.chapters.reduce((sum, chapter) => sum + (times.get(`chapter-${chapter.id}`) ?? 0), 0),
    );
  }
  times.set(
    'course',
    index.parts.reduce((sum, part) => sum + (times.get(`part-${part.id}`) ?? 0), 0),
  );
  return times;
}

export interface FastTrackDay {
  title: string;
  why: string;
  must: LessonLecture[];
  should: LessonLecture[];
  /** Print each lesson's depth sections too. */
  depth: boolean;
  capstone?: { partId: string; title: string; brief: string; solution?: CompiledCapstoneSolution };
}

export interface FastTrackLecture {
  id: string;
  plan: FastTrack;
  days: FastTrackDay[];
  guides: CompiledGuide[];
  lessonCount: number;
  /** Minutes to read what the track prints of each lesson, and its guides. */
  readingMinutes: number;
  /** Where each lesson sits, for its kicker and its link to the full lecture. */
  chapters: Map<string, LectureChapter>;
}

/** Only what a track prints of a lesson, so its reading time is honest. */
function condensedWords(lesson: LessonLecture, depth: boolean): number {
  const firstParagraph = lesson.summary?.md.split(/\n\s*\n/)[0] ?? lesson.opening;
  return (
    readingWords(firstParagraph) +
    lesson.remember.reduce((sum, line) => sum + readingWords(line.md), 0) +
    (depth ? lesson.deeper.reduce((sum, part) => sum + readingWords(part.body.md), 0) : 0) +
    lesson.interview.reduce(
      (sum, qa) => sum + readingWords(qa.question.md) + readingWords(qa.answer.md),
      0,
    ) +
    lesson.pitfalls.slice(0, 3).reduce((sum, line) => sum + readingWords(line.md), 0) +
    lesson.terms.reduce((sum, t) => sum + readingWords(`${t.term} ${t.say} ${t.means.md}`), 0)
  );
}

const TRACKS = path.join(contentRoot(), TRACKS_DIR);

/** The ids of the fast tracks in `content/tracks/`, in file order. */
export async function getTrackIds(): Promise<string[]> {
  if (!fs.existsSync(TRACKS)) return [];
  return fs
    .readdirSync(TRACKS)
    .filter((name) => name.endsWith('.yaml'))
    .sort()
    .map((name) => name.replace(/\.yaml$/, ''));
}

/** Each track's id, title and summary, for lists. */
export async function getTrackSummaries(): Promise<{ id: string; title: string; summary: string }[]> {
  const ids = await getTrackIds();
  return Promise.all(
    ids.map(async (id) => {
      const plan = await readYaml(`${TRACKS_DIR.replace(/^content\//, '')}/${id}.yaml`, fastTrackSchema);
      return { id, title: plan.title, summary: plan.summary };
    }),
  );
}

/** A fast track, built from its plan in `content/tracks/<id>.yaml`. */
export async function getTrack(id: string): Promise<FastTrackLecture | undefined> {
  if (!(await getTrackIds()).includes(id)) return undefined;
  const plan = await readYaml(`${TRACKS_DIR.replace(/^content\//, '')}/${id}.yaml`, fastTrackSchema);
  const [index, manifest] = await Promise.all([getLectureIndex(), getManifest()]);
  const chapters = new Map<string, LectureChapter>();
  for (const chapter of allChapters(index)) {
    for (const lessonId of chapter.lessonIds) {
      if (!chapters.has(lessonId)) chapters.set(lessonId, chapter);
    }
  }
  const days = await Promise.all(
    plan.days.map(async (day): Promise<FastTrackDay> => {
      const [must, should] = await Promise.all([lessonsOf(day.must), lessonsOf(day.should)]);
      const part = manifest.parts.find((p) => p.id === day.capstone);
      const solution = part ? await getCapstoneSolution(part.id) : undefined;
      return {
        title: day.title,
        why: day.why,
        must,
        should,
        depth: day.depth === true,
        ...(part
          ? {
              capstone: {
                partId: part.id,
                title: part.capstone.title,
                brief: part.capstone.brief,
                ...(solution ? { solution } : {}),
              },
            }
          : {}),
      };
    }),
  );
  const guides = (await Promise.all(plan.guides.map((guideId) => getGuide(guideId)))).filter(
    (guide): guide is CompiledGuide => guide !== undefined,
  );
  const words =
    days.reduce(
      (sum, day) =>
        sum +
        [...day.must, ...day.should].reduce((n, lesson) => n + condensedWords(lesson, day.depth), 0),
      0,
    ) +
    guides.reduce(
      (sum, guide) =>
        sum + guide.sections.reduce((n, section) => n + readingWords(section.body.md), 0),
      0,
    );
  return {
    id,
    plan,
    days,
    guides,
    lessonCount: days.reduce((sum, day) => sum + day.must.length + day.should.length, 0),
    readingMinutes: Math.max(1, Math.round(words / 200)),
    chapters,
  };
}
