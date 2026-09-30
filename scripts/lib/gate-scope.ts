/*
 * Which lessons need their solutions run again, given the files that changed. Running every
 * gate takes minutes, and most changes touch one lesson or none. Anything a gate depends on
 * beyond a single lesson (the gates themselves, grading, the runners, shared content)
 * widens the scope to everything, so a narrow run never hides a real failure.
 */

export type GateScope = { kind: 'all' } | { kind: 'none' } | { kind: 'lessons'; dirs: string[] };

const LESSON_DIR = /^content\/course\/[^/]+\/[^/]+\//;

const AFFECTS_EVERY_GATE = [
  /^content\/(?!course\/)/,
  /^content\/course\/[^/]+\.ya?ml$/,
  /^content\/course\/[^/]+\/module\.ya?ml$/,
  /^scripts\/lib\//,
  /^scripts\/validate-content\.ts$/,
  /^src\/core\/(content|grading|running|online-test)\//,
  /^src\/adapters\//,
  /^public\/sandbox\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
];

export function gateScope(changedPaths: readonly string[]): GateScope {
  if (changedPaths.some((path) => AFFECTS_EVERY_GATE.some((rule) => rule.test(path)))) {
    return { kind: 'all' };
  }
  const dirs = [
    ...new Set(
      changedPaths.flatMap((path) => {
        const match = LESSON_DIR.exec(path);
        return match ? [match[0]] : [];
      }),
    ),
  ].sort();
  return dirs.length === 0 ? { kind: 'none' } : { kind: 'lessons', dirs };
}

/** Whether a lesson, by the path of its `lesson.yaml`, is inside the scope. */
export function inGateScope(scope: GateScope, lessonPath: string): boolean {
  if (scope.kind === 'all') return true;
  if (scope.kind === 'none') return false;
  const normalised = lessonPath.split('\\').join('/');
  return scope.dirs.some((dir) => normalised.includes(dir));
}
