import vm from 'node:vm';
import { HARNESS_V1 } from '@/core/running/harness';
import { harnessReportSchema, type HarnessReport } from '@/core/running/protocol';

export interface HarnessRun {
  report: HarnessReport;
  /** Lines the harness streamed to the host sink while running. */
  streamed: string[];
  /** Names the harness left on the global object. */
  globals: string[];
}

/**
 * Evaluates the harness string the way a host does: fresh global, optional log sink,
 * `__load`, then `__run`. The report is parsed with the protocol schema, so every
 * harness test also proves the harness speaks the protocol.
 */
export interface HostHooks {
  modules?: Record<string, unknown>;
  matchers?: Record<string, (actual: unknown, ...args: unknown[]) => unknown>;
  afterEach?: () => void;
  separateScopes?: boolean;
}

export async function runHarness(
  code: string,
  tests: string,
  hooks: HostHooks = {},
): Promise<HarnessRun> {
  const streamed: string[] = [];
  const context = vm.createContext({
    setTimeout,
    __hostLog: (line: string) => streamed.push(line),
    ...(hooks.modules ? { __hostModules: hooks.modules } : {}),
    ...(hooks.matchers ? { __hostMatchers: hooks.matchers } : {}),
    ...(hooks.afterEach ? { __hostAfterEach: hooks.afterEach } : {}),
  });
  vm.runInContext(HARNESS_V1, context);
  const load = context.__load as (code: string, tests: string, options?: object) => void;
  const run = context.__run as () => Promise<unknown>;
  load(code, tests, { separateScopes: hooks.separateScopes === true });
  const raw: unknown = await run();
  // Through JSON, as over a real wire: objects from another realm fail `instanceof`.
  const report = harnessReportSchema.parse(JSON.parse(JSON.stringify(raw)));
  return { report, streamed, globals: Object.keys(context) };
}

/** Runs one test body and returns its failure message, or null when it passed. */
export async function messageOf(body: string, code = ''): Promise<string | null> {
  const { report } = await runHarness(code, `test('t', () => { ${body} });`);
  const [only] = report.tests;
  if (!only) throw new Error(`no test ran: ${JSON.stringify(report)}`);
  return only.passed ? null : (only.message ?? '');
}
