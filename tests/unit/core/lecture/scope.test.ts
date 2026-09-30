import { describe, expect, it } from 'vitest';
import {
  audiobookFileName,
  audioPath,
  parseScopeKey,
  pdfFileName,
  pdfPath,
  printPath,
  scopeKey,
} from '@/core/lecture';
import type { LectureScope } from '@/core/lecture';

describe('lecture scopes', () => {
  const scopes: LectureScope[] = [
    { kind: 'course' },
    { kind: 'track', id: 'interview' },
    { kind: 'part', id: 'senior' },
    { kind: 'chapter', id: 'js' },
    { kind: 'lesson', id: 'js.destructuring-and-spread' },
    { kind: 'track', id: 'start-coding' },
  ];

  it('round-trips every kind through its key', () => {
    for (const scope of scopes) expect(parseScopeKey(scopeKey(scope))).toEqual(scope);
    expect(scopes.map(scopeKey)).toEqual([
      'course',
      'track-interview',
      'part-senior',
      'chapter-js',
      'lesson-js.destructuring-and-spread',
      'track-start-coding',
    ]);
  });

  it('rejects keys that name nothing, so a URL cannot reach outside the pages', () => {
    for (const key of [
      '',
      'part-',
      'chapter-JS',
      'lesson-js',
      'lesson-../x',
      'courses',
      'module-js',
    ]) {
      expect(parseScopeKey(key)).toBeUndefined();
    }
  });

  it('serves the PDF beside, not inside, the lecture pages', () => {
    expect(pdfPath({ kind: 'chapter', id: 'js' })).toBe('/pdf/chapter-js.pdf');
    expect(printPath({ kind: 'course' })).toBe('/print/lecture/course');
  });

  it('names the file for a person, without characters a file system refuses', () => {
    expect(pdfFileName('JavaScript')).toBe('Understory lecture, JavaScript.pdf');
    expect(pdfFileName('A/B: "C"?')).toBe('Understory lecture, A B C.pdf');
    expect(pdfFileName('  ')).toBe('Understory lecture, course.pdf');
  });
});

describe('lecture audio', () => {
  it('serves playlists by scope and names downloads for a person', () => {
    expect(audioPath({ kind: 'track', id: 'interview' })).toBe('/audio/track-interview.json');
    expect(audiobookFileName('Python', '/audio/book/chapter-python.m4b')).toBe(
      'Understory audiobook, Python.m4b',
    );
    expect(audiobookFileName('Closures', '/audio/lesson/js.closures.m4a')).toBe(
      'Understory audiobook, Closures.m4a',
    );
  });
});
