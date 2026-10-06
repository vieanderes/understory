import type { CatalogFile } from '../practice';
import { INTEREST_COPY, matchesInterests, type Interest } from '../profile/interests';

/*
 * What the Progress page counts. A learner can look at the whole course, at the path they
 * are on, at one of their interests or at one part. Each scope is a set of lessons and the
 * concepts they teach, plus which exams and timed tests belong to it. Scopes are derived
 * from the catalogue and the learner's choices; nothing about them is stored.
 */

/** A learning path as the scope needs it. */
export interface ScopePath {
  readonly id: string;
  readonly name: string;
  readonly lessonIds: readonly string[];
  /** The path sends the learner to timed coding tests. */
  readonly timedTests: boolean;
}

export type ScopeKind = 'all' | 'path' | 'topic' | 'part';

export interface ProgressScope {
  /** The value kept in the URL: `all`, `path`, `topic-<interest>` or `part-<part>`. */
  readonly id: string;
  readonly kind: ScopeKind;
  readonly label: string;
  /** Published lessons, in course order. */
  readonly lessonIds: readonly string[];
  /** The concepts those lessons teach, in catalogue order. */
  readonly conceptIds: readonly string[];
  /** The parts with a lesson in scope, in course order. */
  readonly partIds: readonly string[];
  /** Paths whose final exam counts here. */
  readonly examPathIds: readonly string[];
  readonly timedTests: boolean;
  /** The practice topic a session for this scope is narrowed to, when one fits. */
  readonly topic?: Interest;
}

export interface ScopeInput {
  readonly catalog: CatalogFile;
  /** The path the learner is on, a built one included. */
  readonly path?: ScopePath;
  /** Every written path, which is every path with a final exam. */
  readonly paths: readonly ScopePath[];
  readonly interests: readonly Interest[];
}

/** Interests whose learners sit timed coding tests. */
const TESTED_INTERESTS: ReadonlySet<Interest> = new Set(['algorithms', 'interviews']);

function scopeOf(
  catalog: CatalogFile,
  fields: Omit<ProgressScope, 'lessonIds' | 'conceptIds' | 'partIds'>,
  keep: (lessonId: string) => boolean,
  concepts?: readonly string[],
): ProgressScope {
  const lessonIds = Object.keys(catalog.lessons).filter(keep);
  const taught = new Set(
    concepts ?? lessonIds.flatMap((id) => catalog.lessons[id]?.concepts ?? []),
  );
  const inScope = new Set(lessonIds);
  return {
    ...fields,
    lessonIds,
    conceptIds: catalog.concepts.map((c) => c.id).filter((id) => taught.has(id)),
    partIds: catalog.parts
      .filter((part) => part.lessons.some((id) => inScope.has(id)))
      .map((part) => part.id),
  };
}

/** Everything, the current path, each interest, then each part: the order the picker shows. */
export function progressScopes(input: ScopeInput): ProgressScope[] {
  const { catalog, path, paths, interests } = input;
  const scopes: ProgressScope[] = [
    scopeOf(
      catalog,
      {
        id: 'all',
        kind: 'all',
        label: 'Everything',
        examPathIds: paths.map((p) => p.id),
        timedTests: true,
      },
      () => true,
    ),
  ];

  if (path) {
    const lessons = new Set(path.lessonIds);
    scopes.unshift(
      scopeOf(
        catalog,
        {
          id: 'path',
          kind: 'path',
          label: path.name,
          examPathIds: paths.some((p) => p.id === path.id) ? [path.id] : [],
          timedTests: path.timedTests,
        },
        (id) => lessons.has(id),
      ),
    );
  }

  for (const interest of interests) {
    scopes.push(
      scopeOf(
        catalog,
        {
          id: `topic-${interest}`,
          kind: 'topic',
          label: INTEREST_COPY[interest].label,
          examPathIds: [],
          timedTests: TESTED_INTERESTS.has(interest),
          topic: interest,
        },
        (id) => matchesInterests(id, [interest]),
      ),
    );
  }

  catalog.parts.forEach((part, i) => {
    const lessons = new Set(part.lessons);
    scopes.push(
      scopeOf(
        catalog,
        {
          id: `part-${part.id}`,
          kind: 'part',
          label: `Part ${i + 1}: ${part.title}`,
          examPathIds: [],
          timedTests: false,
        },
        (id) => lessons.has(id),
        part.concepts,
      ),
    );
  });

  return scopes;
}

/** The scope a URL names, else the learner's path, else everything. */
export function resolveScope(
  scopes: readonly ProgressScope[],
  id: string | null | undefined,
): ProgressScope {
  const named = scopes.find((s) => s.id === id);
  if (named) return named;
  return (
    scopes.find((s) => s.id === 'path') ?? (scopes.find((s) => s.id === 'all') as ProgressScope)
  );
}
