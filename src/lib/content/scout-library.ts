/**
 * Every reference the course carries, for Scout's Librarian (src/core/scout/library.ts).
 * Built once at build time and served as a static file, like the planner's course.
 */
import { libraryEntries, type LibraryEntry } from '@/core/scout';
import { getLesson, getManifest } from './loaders';

export interface ScoutLibraryFile {
  entries: LibraryEntry[];
}

export async function getScoutLibrary(): Promise<ScoutLibraryFile> {
  const manifest = await getManifest();
  const ids = manifest.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const lessons = await Promise.all(ids.map((id) => getLesson(id)));
  return {
    entries: libraryEntries(
      lessons.flatMap((lesson) =>
        lesson
          ? [{ id: lesson.id, moduleId: lesson.moduleId, references: lesson.references }]
          : [],
      ),
    ),
  };
}
