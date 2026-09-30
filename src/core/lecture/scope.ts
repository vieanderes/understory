/*
 * What a lecture covers: one lesson, a chapter, a part, the whole course, or a fast track
 * (a condensed reading plan across the course). A scope has a
 * key that names its PDF and its print page, so the build script, the pages and the
 * download button agree on one spelling.
 */

export type LectureScope =
  | { kind: 'course' }
  | { kind: 'track'; id: string }
  | { kind: 'part'; id: string }
  | { kind: 'chapter'; id: string }
  | { kind: 'lesson'; id: string };

// Module and part ids are lowercase words; track ids are file names, so they may hyphenate;
// lesson ids add a dot and hyphens.
const KEY =
  /^(?:course|(part|chapter)-([a-z][a-z0-9]*)|track-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)|lesson-([a-z][a-z0-9]*\.[a-z0-9]+(?:-[a-z0-9]+)*))$/;

export function scopeKey(scope: LectureScope): string {
  if (scope.kind === 'course') return 'course';
  return `${scope.kind}-${scope.id}`;
}

export function parseScopeKey(key: string): LectureScope | undefined {
  const match = KEY.exec(key);
  if (!match) return undefined;
  const [, kind, groupId, trackId, lessonId] = match;
  if (lessonId !== undefined) return { kind: 'lesson', id: lessonId };
  if (trackId !== undefined) return { kind: 'track', id: trackId };
  if (kind === 'part' && groupId !== undefined) return { kind: 'part', id: groupId };
  if (kind === 'chapter' && groupId !== undefined) return { kind: 'chapter', id: groupId };
  return { kind: 'course' };
}

/** Where the built PDF is served. Outside `/lectures`, so a file never shadows a page. */
export const pdfPath = (scope: LectureScope): string => `/pdf/${scopeKey(scope)}.pdf`;

/** The page the PDF is printed from, and the fallback when no PDF was built. */
export const printPath = (scope: LectureScope): string => `/print/lecture/${scopeKey(scope)}`;

/** A file name a person recognises in their downloads folder. */
export function pdfFileName(title: string): string {
  const safe = title
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `Understory lecture, ${safe || 'course'}.pdf`;
}

/**
 * The playlist of a lecture's audio (scripts/build-audio.ts): a lesson has one track, a
 * chapter, part, course or fast track one per lesson or section.
 */
export interface AudioPlaylist {
  title: string;
  items: { title: string; src: string; seconds: number }[];
  /** The whole playlist as one file to download: an m4b with chapters, or a lesson's m4a. */
  book?: { src: string; bytes: number };
}

/** A file name a person recognises for a downloaded audiobook. */
export function audiobookFileName(title: string, src: string): string {
  const extension = src.endsWith('.m4b') ? 'm4b' : 'm4a';
  return pdfFileName(title)
    .replace(/^Understory lecture/, 'Understory audiobook')
    .replace(/\.pdf$/, `.${extension}`);
}

/** Where a scope's playlist is served. Absent until its audio has been generated. */
export const audioPath = (scope: LectureScope): string => `/audio/${scopeKey(scope)}.json`;
