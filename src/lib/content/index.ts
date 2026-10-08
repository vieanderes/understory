/**
 * The only import surface for pages and features. `fs.ts` is for scripts. Reaching past
 * this file from `src/app` or `src/features` couples a screen to the file layout.
 */
export {
  getAllLessonRoutes,
  getCatalogSummary,
  getConcept,
  getCourse,
  getGlossary,
  getLesson,
  getLessonByRoute,
  getManifest,
  getModule,
  getModules,
  getPlacement,
  resetContentCache,
} from './loaders';
export type { CatalogSummary, ConceptEntry, LessonRoute } from './loaders';
export { ContentError } from './fs';
export { getOnlineTestIndex } from './online-tests';
export { getPlanCatalog } from './plan-catalog';
export { getPlannerCourse } from './planner-course';
export type { PlannerCourseFile } from './planner-course';
export { getPath, getPaths } from './paths';
export type { PathLesson, PathStage, PathSummary, PathTest } from './paths';
export {
  findLectureChapter,
  getChapterLecture,
  getTrack,
  getTrackIds,
  getTrackSummaries,
  getLectureIndex,
  getLectureTimes,
  getLessonLecture,
  getPartLecture,
} from './lectures';
export type {
  ChapterLecture,
  FastTrackDay,
  FastTrackLecture,
  LectureChapter,
  LectureIndex,
  LecturePart,
  PartLecture,
} from './lectures';
export type {
  CompiledLesson,
  CompiledStep,
  Manifest,
  ManifestCourse,
  ManifestLesson,
  ManifestModule,
  Rich,
} from '@/core/content/compiled';
