import { fastTrackSchema, TRACKS_DIR } from '@/core/content/notes';
import { resolveStageTest, type PathTest } from '@/core/online-test/path-tests';
import { readYaml } from './fs';
import { getManifest } from './loaders';
import { getTrackIds } from './lectures';
import { getOnlineTestIndex } from './online-tests';

/**
 * A path: one goal, a few stages, at most about 25 lessons, and a clear finish. Paths are
 * the front door of the app; the full course is the library behind them. A path is written
 * as a track in `content/tracks/<id>.yaml`, so its lecture, PDF and audio come for free.
 */
export type { PathTest };

export interface PathLesson {
  id: string;
  title: string;
  objective: string;
  minutes: number;
  /** Null while the lesson is planned but not written. */
  href: string | null;
}

export interface PathStage {
  title: string;
  why: string;
  /** What you leave the stage with. */
  artifact?: string;
  lessons: PathLesson[];
  /** Worth doing if there is time; never counted towards finishing the path. */
  optional: PathLesson[];
  /** Timed tests that check the stage, easiest first. Optional, recommended. */
  tests?: PathTest[];
  /** The stage as a lecture: a stage of the path's lecture, or a chapter's. */
  lectureHref?: string;
}

export interface PathSummary {
  id: string;
  name: string;
  title: string;
  promise: string;
  summary: string;
  outcomes: string[];
  /** How to work through one lesson. */
  method: string[];
  /** How a strong answer is shaped, per kind of round. */
  shapes: { label: string; text: string }[];
  /** Practice outside the lessons: timed tests in the simulator, labs. */
  practice: { label: string; href: string; text: string }[];
  decision?: string;
  readyWhen: string[];
  proof?: { title: string; evidence: string[] };
  coverage?: { covered: string[]; partial: string[]; outside: string[] };
  stages: PathStage[];
  /** The lessons that finish the path, in order. */
  lessonIds: string[];
  minutes: number;
}

async function readPath(id: string): Promise<PathSummary> {
  const [plan, manifest, index] = await Promise.all([
    readYaml(`${TRACKS_DIR.replace(/^content\//, '')}/${id}.yaml`, fastTrackSchema),
    getManifest(),
    getOnlineTestIndex(),
  ]);
  const lessons = new Map(
    manifest.modules.flatMap((module) =>
      module.lessons.map((lesson) => [
        lesson.id,
        {
          id: lesson.id,
          title: lesson.title,
          objective: lesson.objective,
          minutes: lesson.minutes,
          href: `/learn/${module.slug}/${lesson.slug}`,
        } satisfies PathLesson,
      ]),
    ),
  );
  const lesson = (lessonId: string): PathLesson =>
    lessons.get(lessonId) ?? { id: lessonId, title: lessonId, objective: '', minutes: 0, href: null };

  const stages = plan.days.map((day, i) => ({
    title: day.title,
    why: day.why,
    ...(day.artifact ? { artifact: day.artifact } : {}),
    lessons: day.must.map(lesson),
    optional: day.should.map(lesson),
    tests: day.tests.map((ref) => resolveStageTest(ref, index, lesson)),
    // The anchor FastTrackView gives each stage of the track lecture.
    lectureHref: `/lectures/tracks/${id}#day-${i + 1}`,
  }));
  const required = stages.flatMap((stage) => stage.lessons);
  return {
    id,
    name: plan.name ?? plan.title,
    title: plan.title,
    promise: plan.promise ?? plan.summary,
    summary: plan.summary,
    outcomes: plan.outcomes,
    method: plan.method,
    shapes: plan.shapes,
    practice: plan.practice,
    ...(plan.decision ? { decision: plan.decision } : {}),
    readyWhen: plan.readyWhen,
    ...(plan.proof ? { proof: plan.proof } : {}),
    ...(plan.coverage ? { coverage: plan.coverage } : {}),
    stages,
    lessonIds: required.map((l) => l.id),
    minutes: required.reduce((sum, l) => sum + l.minutes, 0),
  };
}

/** Every path, in the order the paths set for themselves. */
export async function getPaths(): Promise<PathSummary[]> {
  const ids = await getTrackIds();
  const plans = await Promise.all(
    ids.map(async (id) => ({
      id,
      order: (await readYaml(`${TRACKS_DIR.replace(/^content\//, '')}/${id}.yaml`, fastTrackSchema))
        .order,
    })),
  );
  const ordered = plans
    .filter((p) => p.order !== undefined)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return Promise.all(ordered.map((p) => readPath(p.id)));
}

export async function getPath(id: string): Promise<PathSummary | undefined> {
  return (await getPaths()).find((p) => p.id === id);
}
