import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'sucrase';
import { parse } from 'yaml';
import { NodePyodideRunner } from '../../src/adapters/node-runner/pyodide-runner';
import { NodeWorkerRunner } from '../../src/adapters/node-runner/worker-runner';
import { createSucraseTranspiler } from '../../src/adapters/transpile/sucrase';
import { createNodeTypeChecker } from '../../src/adapters/typecheck/node';
import type { TypeChecker } from '../../src/core/ports/type-checker';
import type { Issue } from '../../src/core/content/catalog';
import {
  changedLines,
  CORRECTNESS_LIMIT_MS,
  DEFAULT_PERFORMANCE_LIMIT_MS,
  formatJson,
  formatValue,
  hashValue,
  isValueOf,
  PYTHON_TIME_FACTOR,
  platformCompileErrors,
  presetFileSchema,
  runCase,
  SIGNATURE_SLOT,
  starterCode,
  taskFileSchema,
  TASK_LANGUAGES,
  type CaseInput,
  type CaseOutcome,
  type CompiledPreset,
  type CompiledTaskGuide,
  finalSolution,
  guideFileSchema,
  type GuideFile,
  type CompiledTask,
  type OnlineTestIndex,
  type PresetFile,
  type TaskFile,
  type TaskLanguage,
} from '../../src/core/online-test';
import type { CodeRunner } from '../../src/core/ports/code-runner';
import type { Renderer } from './render';

/*
 * The online-test simulator's content (docs/ONLINE-TEST.md, "Authoring"): tasks under
 * content/online-tests/tasks/<id>/ and preset tests under content/online-tests/tests/.
 *
 * The TypeScript reference solution is the source of truth for every expected value: the
 * build runs it on every case, through the same harness and case program the browser uses,
 * and stores the hash of what it returns. The gates (validate only) then prove the rest:
 *
 *   1. an expected value an author wrote agrees with the reference;
 *   2. the Python reference returns the same on every case, which also proves the two
 *      generator copies build the same inputs;
 *   3. each reference finishes every performance case in half its limit;
 *   4. a brute force, when given, passes every correctness case and times out on at least
 *      one performance case, so the performance tests measure the complexity;
 *   5. a bug-fix reference changes at least one line and no more than allowed, and the
 *      buggy starter fails at least one test.
 */

export const ONLINE_TESTS_DIR = 'content/online-tests';
const TASKS_DIR = `${ONLINE_TESTS_DIR}/tasks`;
const PRESETS_DIR = `${ONLINE_TESTS_DIR}/tests`;

export interface TaskSource {
  dir: string;
  path: string;
  task: TaskFile;
  files: {
    ts: string;
    python?: string;
    brute?: string;
    buggyTs?: string;
    buggyPython?: string;
  };
  /** guide.yaml, when the task has one (guided mode). */
  guide?: GuideFile;
}

export interface LoadedOnlineTests {
  tasks: TaskSource[];
  presets: { path: string; preset: PresetFile }[];
  issues: Issue[];
}

const rel = (root: string, file: string): string => path.relative(root, file);

function readIf(file: string): string | undefined {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : undefined;
}

export function loadOnlineTests(root: string): LoadedOnlineTests {
  const issues: Issue[] = [];
  const tasks: TaskSource[] = [];
  const presets: LoadedOnlineTests['presets'] = [];
  const error = (file: string, message: string, rule: string, where?: string): void => {
    issues.push({
      severity: 'error',
      path: rel(root, file),
      message,
      rule,
      ...(where ? { where } : {}),
    });
  };

  const tasksDir = path.join(root, TASKS_DIR);
  const dirs = fs.existsSync(tasksDir)
    ? fs
        .readdirSync(tasksDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort()
    : [];
  for (const name of dirs) {
    const dir = path.join(tasksDir, name);
    const file = path.join(dir, 'task.yaml');
    if (!fs.existsSync(file)) {
      error(dir, 'A task folder needs a task.yaml.', 'online-test-missing-file');
      continue;
    }
    const parsed = taskFileSchema.safeParse(parse(fs.readFileSync(file, 'utf8')));
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        error(
          file,
          `${problem.path.join('.') || 'file'}: ${problem.message}`,
          'online-test-schema',
        );
      }
      continue;
    }
    const task = parsed.data;
    if (task.id !== name)
      error(file, `The id "${task.id}" must match the folder name "${name}".`, 'online-test-id');
    const ts = readIf(path.join(dir, 'solution.ts'));
    if (ts === undefined) {
      error(
        file,
        'Every task needs solution.ts, the reference every expected value comes from.',
        'online-test-missing-file',
      );
      continue;
    }
    const files: TaskSource['files'] = { ts };
    let guide: GuideFile | undefined;
    const guideText = readIf(path.join(dir, 'guide.yaml'));
    if (guideText !== undefined) {
      const parsedGuide = guideFileSchema.safeParse(parse(guideText));
      if (parsedGuide.success) guide = parsedGuide.data;
      else {
        for (const problem of parsedGuide.error.issues) {
          error(
            path.join(dir, 'guide.yaml'),
            `${problem.path.join('.') || 'file'}: ${problem.message}`,
            'online-test-guide',
          );
        }
      }
    }
    const optional = {
      python: 'solution.py',
      brute: 'brute.ts',
      buggyTs: 'buggy.ts',
      buggyPython: 'buggy.py',
    } as const;
    for (const [key, fileName] of Object.entries(optional) as [keyof typeof optional, string][]) {
      const content = readIf(path.join(dir, fileName));
      if (content !== undefined) files[key] = content;
    }
    if (files.python === undefined) {
      error(
        file,
        'Every task needs solution.py, so it can be sat in Python.',
        'online-test-missing-file',
      );
    }
    if (
      task.type === 'bug-fix' &&
      (files.buggyTs === undefined || files.buggyPython === undefined)
    ) {
      error(
        file,
        'A bug-fix task needs buggy.ts and buggy.py: the code the candidate starts from.',
        'online-test-missing-file',
      );
    }
    if (task.type !== 'bug-fix' && task.maxChangedLines !== undefined) {
      error(file, 'maxChangedLines is for bug-fix tasks only.', 'online-test-schema');
    }
    if (!task.statement.includes('{{signature}}')) {
      error(
        file,
        'The statement needs a {{signature}} line, where the function is shown per language.',
        'online-test-schema',
      );
    }
    const hidden = task.tests.reduce((sum, t) => sum + t.cases.length, 0);
    if (hidden < 8) {
      error(
        file,
        `Only ${hidden} hidden cases. The platform promises at least 8; write at least 8.`,
        'online-test-coverage',
      );
    }
    if (task.type === 'algorithmic' && !task.tests.some((t) => t.group === 'performance')) {
      error(
        file,
        'An algorithmic task needs at least one performance test. A correctness-only task is type: coding.',
        'online-test-coverage',
      );
    }
    if (task.type !== 'algorithmic' && task.tests.some((t) => t.group === 'performance')) {
      error(file, 'Only algorithmic tasks have performance tests.', 'online-test-coverage');
    }
    const names = new Set<string>();
    for (const test of task.tests) {
      if (names.has(test.name))
        error(file, `The test name "${test.name}" is used twice.`, 'online-test-schema', test.name);
      names.add(test.name);
    }
    const params = task.signature.params;
    const checkArgs = (args: unknown[], where: string): void => {
      if (args.length !== params.length || !params.every((p, i) => isValueOf(p.type, args[i]))) {
        error(
          file,
          `The arguments do not match the signature (${params.map((p) => p.type).join(', ')}).`,
          'online-test-schema',
          where,
        );
      }
    };
    task.examples.forEach((ex, i) => checkArgs(ex.args, `examples[${i}]`));
    for (const test of task.tests) {
      test.cases.forEach((c, i) => {
        if ('args' in c) checkArgs(c.args, `${test.name}[${i}]`);
        else if (c.generate.args.length !== params.length) {
          error(
            file,
            'A generated case needs one spec per parameter.',
            'online-test-schema',
            `${test.name}[${i}]`,
          );
        }
      });
    }
    tasks.push({ dir, path: rel(root, file), task, files, ...(guide ? { guide } : {}) });
  }

  const presetsDir = path.join(root, PRESETS_DIR);
  const presetFiles = fs.existsSync(presetsDir)
    ? fs
        .readdirSync(presetsDir)
        .filter((f) => f.endsWith('.yaml'))
        .sort()
    : [];
  const taskIds = new Set(tasks.map((t) => t.task.id));
  for (const name of presetFiles) {
    const file = path.join(presetsDir, name);
    const parsed = presetFileSchema.safeParse(parse(fs.readFileSync(file, 'utf8')));
    if (!parsed.success) {
      for (const problem of parsed.error.issues) {
        error(
          file,
          `${problem.path.join('.') || 'file'}: ${problem.message}`,
          'online-test-schema',
        );
      }
      continue;
    }
    const preset = parsed.data;
    if (`${preset.id}.yaml` !== name)
      error(file, `The id "${preset.id}" must match the file name.`, 'online-test-id');
    for (const id of preset.tasks) {
      if (!taskIds.has(id) && dirs.includes(id) === false)
        error(file, `No task "${id}".`, 'online-test-reference');
    }
    presets.push({ path: rel(root, file), preset });
  }
  return { tasks, presets, issues };
}

// ---- Running the references -----------------------------------------------------------

export interface OnlineRunners {
  script: CodeRunner;
  python: () => CodeRunner;
  typecheck: () => TypeChecker;
  dispose(): void;
}

export function createOnlineRunners(): OnlineRunners {
  const script = new NodeWorkerRunner(createSucraseTranspiler(transform));
  let python: NodePyodideRunner | undefined;
  let checker: TypeChecker | undefined;
  return {
    script,
    python: () => (python ??= new NodePyodideRunner()),
    typecheck: () => (checker ??= createNodeTypeChecker()),
    dispose: () => python?.dispose(),
  };
}

/** Types stripped, so the JavaScript solution in the bundle is the reference itself. */
export function toJavaScript(ts: string): string {
  return (
    transform(ts, { transforms: ['typescript'], disableESTransforms: true }).code.trim() + '\n'
  );
}

interface PlannedCase {
  where: string;
  group: 'example' | 'correctness' | 'performance';
  input: CaseInput;
  expected?: unknown;
}

function planCases(task: TaskFile): PlannedCase[] {
  const out: PlannedCase[] = task.examples.map((ex, i) => ({
    where: `examples[${i}]`,
    group: 'example',
    input: { args: ex.args },
    ...(ex.expected === undefined ? {} : { expected: ex.expected }),
  }));
  for (const test of task.tests) {
    test.cases.forEach((c, i) => {
      out.push({
        where: `${test.name}[${i}]`,
        group: test.group,
        input: 'args' in c ? { args: c.args } : { generate: c.generate },
        ...('args' in c && c.expected !== undefined ? { expected: c.expected } : {}),
      });
    });
  }
  return out;
}

/** Generous: the build must never fail on a loaded machine. Speed is gated separately. */
const REFERENCE_BUDGET_MS = 20_000;

export interface Reference {
  /** Per planned case, in order: the reference's result. */
  outcomes: CaseOutcome[];
  issues: Issue[];
}

export async function runReference(source: TaskSource, runners: OnlineRunners): Promise<Reference> {
  const issues: Issue[] = [];
  const outcomes: CaseOutcome[] = [];
  for (const planned of planCases(source.task)) {
    const outcome = await runCase(
      runners.script,
      'ts',
      source.files.ts,
      planned.input,
      REFERENCE_BUDGET_MS - 3000,
    );
    outcomes.push(outcome);
    if (outcome.kind !== 'returned') {
      const why = outcome.kind === 'timeout' ? 'did not finish' : outcome.message;
      issues.push({
        severity: 'error',
        path: source.path,
        where: planned.where,
        message: `The reference solution.ts failed: ${why}.`,
        rule: 'online-test-reference',
      });
      continue;
    }
    if (planned.expected !== undefined && outcome.hash !== hashValue(planned.expected)) {
      issues.push({
        severity: 'error',
        path: source.path,
        where: planned.where,
        message: `The expected value ${formatValue(planned.expected)} disagrees with the reference, which returns ${formatJson(outcome.json, outcome.complete)}.`,
        rule: 'online-test-expected',
      });
    }
  }
  return { outcomes, issues };
}

function previewOf(outcome: CaseOutcome): string {
  return outcome.kind === 'returned' ? formatJson(outcome.json, outcome.complete) : '?';
}

// ---- Compiling ------------------------------------------------------------------------

export function compileTask(
  source: TaskSource,
  reference: Reference,
  render: Renderer,
): CompiledTask {
  const { task, files } = source;
  const planned = planCases(task);
  const outcomeAt = (where: string): CaseOutcome | undefined =>
    reference.outcomes[planned.findIndex((p) => p.where === where)];
  const hashAt = (where: string): string => {
    const outcome = outcomeAt(where);
    return outcome?.kind === 'returned' ? outcome.hash : '';
  };

  const statementHtml = render
    .markdown(task.statement.replace('{{signature}}', 'OT_SIGNATURE_SLOT'))
    .replace(/<p>OT_SIGNATURE_SLOT<\/p>|OT_SIGNATURE_SLOT/, SIGNATURE_SLOT);
  const starters: Record<TaskLanguage, string> =
    task.type === 'bug-fix' && files.buggyTs !== undefined && files.buggyPython !== undefined
      ? { ts: files.buggyTs, js: toJavaScript(files.buggyTs), python: files.buggyPython }
      : {
          js: starterCode(task.signature, 'js'),
          ts: starterCode(task.signature, 'ts'),
          python: starterCode(task.signature, 'python'),
        };

  return {
    id: task.id,
    title: task.title,
    topic: task.topic,
    difficulty: task.difficulty,
    type: task.type,
    recommendedMinutes: task.recommendedMinutes,
    ...(task.maxChangedLines === undefined ? {} : { maxChangedLines: task.maxChangedLines }),
    signature: task.signature,
    statementHtml,
    starters,
    examples: task.examples.map((ex, i) => {
      const outcome = outcomeAt(`examples[${i}]`);
      const expected =
        ex.expected ??
        (outcome?.kind === 'returned' && outcome.complete
          ? (JSON.parse(outcome.json) as typeof ex.expected)
          : undefined) ??
        0;
      return { args: ex.args, expected, expectedHash: hashAt(`examples[${i}]`) };
    }),
    tests: task.tests.map((test) => ({
      name: test.name,
      description: test.description,
      group: test.group,
      cases: test.cases.map((c, i) => {
        const where = `${test.name}[${i}]`;
        const outcome = outcomeAt(where);
        return {
          input: 'args' in c ? { args: c.args } : { generate: c.generate },
          expected: { hash: hashAt(where), preview: outcome ? previewOf(outcome) : '?' },
        };
      }),
    })),
    timeLimitMs: task.timeLimitMs ?? DEFAULT_PERFORMANCE_LIMIT_MS,
  };
}

export function compilePresets(loaded: LoadedOnlineTests): CompiledPreset[] {
  return loaded.presets
    .map(({ preset }) => ({ ...preset, languages: preset.languages ?? [...TASK_LANGUAGES] }))
    .sort((a, b) => a.order - b.order);
}

export function compileIndex(loaded: LoadedOnlineTests): OnlineTestIndex {
  return {
    presets: compilePresets(loaded),
    tasks: loaded.tasks.map(({ task }) => ({
      id: task.id,
      title: task.title,
      topic: task.topic,
      difficulty: task.difficulty,
      type: task.type,
      recommendedMinutes: task.recommendedMinutes,
      guided: loaded.tasks.find((t) => t.task.id === task.id)?.guide !== undefined,
    })),
  };
}

/** A task's guide for the bundle: markdown rendered, JavaScript derived from TypeScript. */
export function compileGuide(source: TaskSource, render: Renderer): CompiledTaskGuide | undefined {
  const guide = source.guide;
  if (!guide) return undefined;
  return {
    taskId: source.task.id,
    approachHtml: render.markdown(guide.approach),
    complexity: guide.complexity,
    steps: guide.steps.map((step) => ({
      kind: step.kind,
      title: step.title,
      bodyHtml: render.markdown(step.body),
      ...(step.minutes === undefined ? {} : { minutes: step.minutes }),
      ...(step.prompt === undefined ? {} : { prompt: step.prompt }),
      ...(step.code
        ? { code: { ts: step.code.ts, js: toJavaScript(step.code.ts), python: step.code.python } }
        : {}),
      ...(step.codeMode === undefined ? {} : { codeMode: step.codeMode }),
      ...(step.input === undefined ? {} : { input: step.input }),
      ...(step.expect === undefined ? {} : { expect: step.expect }),
    })),
  };
}

export function compileSolutions(
  loaded: LoadedOnlineTests,
): Record<string, Record<TaskLanguage, string>> {
  const out: Record<string, Record<TaskLanguage, string>> = {};
  for (const { task, files } of loaded.tasks) {
    out[task.id] = { ts: files.ts, js: toJavaScript(files.ts), python: files.python ?? '' };
  }
  return out;
}

// ---- Gates ----------------------------------------------------------------------------

export async function gateTask(
  source: TaskSource,
  reference: Reference,
  runners: OnlineRunners,
): Promise<Issue[]> {
  const issues: Issue[] = [];
  const { task, files } = source;
  const issue = (message: string, rule: string, where?: string): void => {
    issues.push({
      severity: 'error',
      path: source.path,
      message,
      rule,
      ...(where ? { where } : {}),
    });
  };
  const planned = planCases(task);
  const limitMs = task.timeLimitMs ?? DEFAULT_PERFORMANCE_LIMIT_MS;

  // 0. Every TypeScript file compiles under the simulator's rules, as a candidate's would.
  const typeScript: [string, string | undefined][] = [
    ['solution.ts', files.ts],
    ['brute.ts', files.brute],
    ['buggy.ts', files.buggyTs],
  ];
  for (const [name, code] of typeScript) {
    if (code === undefined) continue;
    const outcome = await runners.typecheck().check({ code, tests: '' });
    if (outcome.status !== 'checked') continue;
    const errors = platformCompileErrors(outcome.diagnostics);
    if (errors.length > 0) {
      issue(`${name} does not compile: ${errors[0]}`, 'online-test-typecheck');
    }
  }

  // 6. A guide's code: every full step compiles, and the last one scores 100% in both
  //    languages, so guided mode never leads anyone to a wrong answer.
  if (source.guide) {
    for (const [i, step] of source.guide.steps.entries()) {
      if (step.codeMode !== 'full' || !step.code) continue;
      const outcome = await runners.typecheck().check({ code: step.code.ts, tests: '' });
      if (outcome.status === 'checked') {
        const errors = platformCompileErrors(outcome.diagnostics);
        if (errors.length > 0)
          issue(`guide step ${i + 1} does not compile: ${errors[0]}`, 'online-test-guide');
      }
    }
    const final = finalSolution(source.guide);
    if (final) {
      for (const [i, p] of planned.entries()) {
        const ref = reference.outcomes[i];
        if (ref?.kind !== 'returned') continue;
        const limit = p.group === 'performance' ? limitMs : CORRECTNESS_LIMIT_MS;
        const ts = await runCase(runners.script, 'ts', final.ts, p.input, limit);
        // Speed is the reference's gate (3); here the point is the answer, so noise gets room.
        if (ts.kind !== 'returned' || ts.hash !== ref.hash || ts.ms > limit * 2) {
          issue(
            `The guide's final TypeScript solution fails ${p.where}.`,
            'online-test-guide',
            p.where,
          );
          break;
        }
      }
      const python = runners.python();
      for (const [i, p] of planned.entries()) {
        const ref = reference.outcomes[i];
        if (ref?.kind !== 'returned') continue;
        const limit =
          (p.group === 'performance' ? limitMs * PYTHON_TIME_FACTOR : CORRECTNESS_LIMIT_MS) * 2;
        const py = await runCase(python, 'python', final.python, p.input, Math.max(limit, 10_000));
        if (py.kind !== 'returned' || py.hash !== ref.hash) {
          issue(
            `The guide's final Python solution fails ${p.where}.`,
            'online-test-guide',
            p.where,
          );
          break;
        }
      }
    }
  }

  // 3. The TypeScript reference is fast enough, in half the limit. A busy machine can slow
  //    one run, so a slow case is timed again and the faster run counts: a solution that is
  //    really too slow fails both.
  for (const [i, p] of planned.entries()) {
    const outcome = reference.outcomes[i];
    if (p.group !== 'performance' || outcome?.kind !== 'returned' || outcome.ms <= limitMs / 2)
      continue;
    const again = await runCase(
      runners.script,
      'ts',
      files.ts,
      p.input,
      REFERENCE_BUDGET_MS - 3000,
    );
    const ms = again.kind === 'returned' ? Math.min(outcome.ms, again.ms) : outcome.ms;
    if (ms > limitMs / 2) {
      issue(
        `solution.ts took ${ms.toFixed(0)} ms, more than half the ${limitMs} ms limit. Raise timeLimitMs or speed it up.`,
        'online-test-speed',
        p.where,
      );
    }
  }

  // 2. Python agrees, within its own limit.
  if (files.python !== undefined) {
    const python = runners.python();
    for (const [i, p] of planned.entries()) {
      const ref = reference.outcomes[i];
      if (ref?.kind !== 'returned') continue;
      const pyLimit =
        p.group === 'performance' ? limitMs * PYTHON_TIME_FACTOR : CORRECTNESS_LIMIT_MS;
      const outcome = await runCase(
        python,
        'python',
        files.python,
        p.input,
        Math.max(pyLimit * 2, 10_000),
      );
      if (outcome.kind !== 'returned') {
        issue(
          `solution.py failed: ${outcome.kind === 'timeout' ? 'did not finish' : outcome.message}.`,
          'online-test-python',
          p.where,
        );
      } else if (outcome.hash !== ref.hash) {
        issue(
          `solution.py returns ${formatJson(outcome.json, outcome.complete)}, the TypeScript reference ${previewOf(ref)}.`,
          'online-test-python',
          p.where,
        );
      } else if (p.group === 'performance' && outcome.ms > pyLimit / 2) {
        issue(
          `solution.py took ${outcome.ms.toFixed(0)} ms, more than half its ${pyLimit} ms limit.`,
          'online-test-speed',
          p.where,
        );
      }
    }
  }

  // 4. The brute force passes correctness and fails performance on time alone.
  if (files.brute !== undefined) {
    let timedOut = false;
    for (const [i, p] of planned.entries()) {
      const ref = reference.outcomes[i];
      if (ref?.kind !== 'returned' || p.group === 'example') continue;
      if (p.group === 'performance' && timedOut) continue;
      const limit = p.group === 'performance' ? limitMs : CORRECTNESS_LIMIT_MS;
      const outcome = await runCase(runners.script, 'ts', files.brute, p.input, limit);
      if (p.group === 'correctness' && (outcome.kind !== 'returned' || outcome.hash !== ref.hash)) {
        issue(
          'brute.ts must pass every correctness case, so it shows what full correctness with poor performance scores.',
          'online-test-brute',
          p.where,
        );
      }
      if (
        p.group === 'performance' &&
        (outcome.kind === 'timeout' || (outcome.kind === 'returned' && outcome.ms > limit))
      ) {
        timedOut = true;
      }
    }
    if (!timedOut)
      issue(
        'brute.ts finished every performance case in time. Make the large inputs larger, or the limit tighter.',
        'online-test-brute',
      );
  }

  // 5. Bug-fix: the reference is a small fix of the buggy starter, and the starter is wrong.
  if (task.type === 'bug-fix' && files.buggyTs !== undefined) {
    const limit = task.maxChangedLines ?? 2;
    const changed = changedLines(files.buggyTs, files.ts);
    if (changed === 0 || changed > limit) {
      issue(
        `solution.ts changes ${changed} lines of buggy.ts; a fix must change between 1 and ${limit}.`,
        'online-test-bugfix',
      );
    }
    if (files.buggyPython !== undefined && files.python !== undefined) {
      const pyChanged = changedLines(files.buggyPython, files.python);
      if (pyChanged === 0 || pyChanged > limit) {
        issue(
          `solution.py changes ${pyChanged} lines of buggy.py; a fix must change between 1 and ${limit}.`,
          'online-test-bugfix',
        );
      }
    }
    let fails = false;
    for (const [i, p] of planned.entries()) {
      const ref = reference.outcomes[i];
      if (ref?.kind !== 'returned' || p.group === 'example') continue;
      const outcome = await runCase(
        runners.script,
        'ts',
        files.buggyTs,
        p.input,
        CORRECTNESS_LIMIT_MS,
      );
      if (outcome.kind !== 'returned' || outcome.hash !== ref.hash) {
        fails = true;
        break;
      }
    }
    if (!fails)
      issue(
        'buggy.ts passes every test, so there is nothing to fix. A hidden test must catch the bug.',
        'online-test-bugfix',
      );
  }
  return issues;
}

/** Everything the validator reports for the online tests, gates included when asked. */
/** Tasks in flight at once. Worker runs are independent; Python queues on its one interpreter. */
const CONCURRENCY = 4;

async function eachLimited<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, lane));
  return results;
}

export async function checkOnlineTests(
  root: string,
  { gates, only }: { gates: boolean; only?: string },
): Promise<Issue[]> {
  const loaded = loadOnlineTests(root);
  const issues = [...loaded.issues];
  if (!gates || loaded.tasks.length === 0) return issues;
  const runners = createOnlineRunners();
  try {
    const chosen = loaded.tasks.filter((s) => only === undefined || s.path.includes(only));
    const found = await eachLimited(chosen, async (source) => {
      const reference = await runReference(source, runners);
      if (reference.issues.length > 0) return reference.issues;
      return gateTask(source, reference, runners);
    });
    issues.push(...found.flat());
  } finally {
    runners.dispose();
  }
  return issues;
}

// ---- The build's cache ----------------------------------------------------------------

/*
 * The expected values are what solution.ts returns, which only changes when the task does.
 * So the build keeps them per task, keyed by a hash of the task's files and the case
 * program's version, and a rebuild with unchanged tasks runs nothing. The cache is local
 * (node_modules/.cache), never committed, and the output is the same with or without it.
 */
const CACHE_FILE = 'node_modules/.cache/understory/online-test-references.json';
const CACHE_VERSION = 1;

function referenceKey(source: TaskSource): string {
  const hash = createHash('sha256');
  hash.update(String(CACHE_VERSION));
  hash.update(JSON.stringify(source.task));
  hash.update(source.files.ts);
  return hash.digest('hex');
}

function readCache(root: string): Record<string, Reference> {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, CACHE_FILE), 'utf8')) as Record<
      string,
      Reference
    >;
  } catch {
    return {};
  }
}

function writeCache(root: string, cache: Record<string, Reference>): void {
  try {
    fs.mkdirSync(path.dirname(path.join(root, CACHE_FILE)), { recursive: true });
    fs.writeFileSync(path.join(root, CACHE_FILE), JSON.stringify(cache));
  } catch {
    // A read-only tree builds without a cache.
  }
}

/** Writes the simulator's part of the bundle. Returns the task count. */
export async function writeOnlineTests(
  root: string,
  outDir: string,
  render: Renderer,
): Promise<{ tasks: number; issues: Issue[] }> {
  const loaded = loadOnlineTests(root);
  if (loaded.issues.some((i) => i.severity === 'error')) return { tasks: 0, issues: loaded.issues };
  const runners = createOnlineRunners();
  const issues: Issue[] = [];
  const dir = path.join(outDir, 'online-tests');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'guides'), { recursive: true });
  const cache = readCache(root);
  const nextCache: Record<string, Reference> = {};
  try {
    const references = await eachLimited(loaded.tasks, async (source) => {
      const key = referenceKey(source);
      const hit = cache[key];
      const reference = hit && hit.issues.length === 0 ? hit : await runReference(source, runners);
      if (reference.issues.length === 0) nextCache[key] = reference;
      return reference;
    });
    loaded.tasks.forEach((source, i) => {
      const reference = references[i]!;
      issues.push(...reference.issues);
      const compiled = compileTask(source, reference, render);
      fs.writeFileSync(path.join(dir, 'tasks', `${compiled.id}.json`), JSON.stringify(compiled));
      const guide = compileGuide(source, render);
      if (guide)
        fs.writeFileSync(path.join(dir, 'guides', `${compiled.id}.json`), JSON.stringify(guide));
    });
  } finally {
    runners.dispose();
  }
  writeCache(root, nextCache);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(compileIndex(loaded)));
  fs.writeFileSync(path.join(dir, 'solutions.json'), JSON.stringify(compileSolutions(loaded)));
  return { tasks: loaded.tasks.length, issues };
}
