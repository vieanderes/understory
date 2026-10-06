'use client';

import { useSyncExternalStore } from 'react';
import type { PlannerCourseFile } from '@/lib/content';

/*
 * The course for planning, fetched once when plan mode first opens: a static file built
 * with the site (/api/planner/course), so drafts are checked against the same lessons
 * Scout was given.
 */

export type PlannerCourse = PlannerCourseFile['course'];

type Loaded =
  { status: 'loading' | 'failed'; course: null } | { status: 'ready'; course: PlannerCourse };

let loaded: Loaded = { status: 'loading', course: null };
let started = false;
const listeners = new Set<() => void>();

function load(): void {
  if (started) return;
  started = true;
  fetch('/api/planner/course')
    .then((response) => (response.ok ? (response.json() as Promise<PlannerCourseFile>) : null))
    .then((file) => {
      loaded = file ? { status: 'ready', course: file.course } : { status: 'failed', course: null };
    })
    .catch(() => {
      loaded = { status: 'failed', course: null };
    })
    .finally(() => {
      // A failure may pass; the next open tries again.
      if (loaded.status === 'failed') started = false;
      listeners.forEach((listener) => listener());
    });
}

const SERVER: Loaded = { status: 'loading', course: null };

export function usePlannerCourse(): Loaded {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      load();
      return () => listeners.delete(listener);
    },
    () => loaded,
    () => SERVER,
  );
}

export interface LessonInfo {
  id: string;
  title: string;
  minutes: number;
  href: string;
  chapter: string;
}

const indexes = new WeakMap<PlannerCourse, Map<string, LessonInfo>>();

export function lessonInfo(course: PlannerCourse): Map<string, LessonInfo> {
  let index = indexes.get(course);
  if (!index) {
    index = new Map();
    for (const mod of course.modules)
      for (const l of mod.lessons)
        index.set(l.id, {
          id: l.id,
          title: l.title,
          minutes: l.minutes,
          href: l.href,
          chapter: mod.title,
        });
    indexes.set(course, index);
  }
  return index;
}
