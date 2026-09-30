import type { CatalogFile } from '@/core/practice';

/*
 * What "Download for offline" fetches, and roughly how much that is. The catalog names
 * every published lesson: its compiled file, its solutions file and its page.
 */

/**
 * The catalog has no byte counts, so the estimate is per minute of lesson, measured on
 * the first modules: about 2.2 KB of lesson file and 4.6 KB of page for each minute.
 * It is shown as "About", and the true figure follows from the browser after the download.
 */
const BYTES_PER_LESSON_MINUTE = 6800;

export function courseUrls(catalog: CatalogFile): string[] {
  return Object.values(catalog.lessons).flatMap((lesson) => [
    `/content/v1/${lesson.file}`,
    ...(lesson.solutionsFile ? [`/content/v1/${lesson.solutionsFile}`] : []),
    `/learn/${lesson.moduleSlug}/${lesson.slug}`,
  ]);
}

export function estimateCourseBytes(catalog: CatalogFile): number {
  const minutes = Object.values(catalog.lessons).reduce((sum, lesson) => sum + lesson.minutes, 0);
  return minutes * BYTES_PER_LESSON_MINUTE;
}

/** `1.4 MB`. One decimal, never `0.0`. */
export function formatMegabytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Math.max(0.1, megabytes).toFixed(1)} MB`;
}
