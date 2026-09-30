import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';
import { transform } from 'sucrase';
import { createSucraseTranspiler } from '../../src/adapters/transpile/sucrase';
import type { Issue, RawLesson } from '../../src/core/content/catalog';
import type { PlaygroundCheck, PlaygroundStep } from '../../src/core/content/schema';
import {
  buildPlaygroundDocument,
  compileComponent,
  evaluateChecks,
  mergeSources,
  parsePlaygroundMessage,
  PROBE_SOURCE,
  type CheckResult,
  type PlaygroundSources,
  type ProbeReport,
} from '../../src/core/playground';

/*
 * The playground gate. For every playground with checks:
 *
 *   1. the solution, laid over the starter, passes every check, with no script error,
 *   2. the starter does not pass every check, so the learner has something to do.
 *
 * It builds the page with the same `buildPlaygroundDocument` the preview uses, loads it
 * into jsdom, and runs the same probe source text the preview frame runs. Only the
 * judging differs in nothing: `evaluateChecks` is shared.
 *
 * Why jsdom and not a real browser: it runs in `pnpm validate:content` on every save, in
 * well under a second, with no browser download. jsdom 30 resolves the cascade and
 * computed colours, lengths in px and keywords, which covers what a beginner playground
 * checks. It has no layout, so a style check on a layout result (the used width of a
 * block, a flex item's size) cannot pass here. Check the declared property instead, or
 * teach that in a lab (docs/SANDBOX.md, "Playground").
 *
 * A React playground (`jsx`) runs whole, as in the browser: the committed React runtime,
 * the component transpiled by the same sucrase transform, and the frame script, which
 * renders it, plays each check's actions on a fresh render and posts its report. jsdom
 * runs the page's scripts, and the gate waits for that report.
 */

export type PlaygroundGate = (lesson: RawLesson, step: PlaygroundStep) => Promise<Issue[]>;

export const noPlaygroundGate: PlaygroundGate = () => Promise.resolve([]);

export interface GatedPage {
  report: ProbeReport;
  results: CheckResult[];
}

type Probe = (
  doc: unknown,
  win: unknown,
  checks: readonly PlaygroundCheck[],
  errors: string[],
) => ProbeReport;

const REACT_RUNTIME = path.join(process.cwd(), 'public/sandbox/react-playground.v1.js');
/** Far longer than a small component needs; a render loop must still end the gate. */
const REACT_TIMEOUT_MS = 10_000;

let runtime: Promise<string> | undefined;
const transpiler = createSucraseTranspiler(transform);

/** Renders a React page in jsdom with its own frame script, and waits for the report. */
async function probeReactPage(
  sources: PlaygroundSources & { jsx: string },
  checks: readonly PlaygroundCheck[],
): Promise<GatedPage> {
  runtime ??= readFile(REACT_RUNTIME, 'utf8');
  const nonce = 'gate';
  const doc = buildPlaygroundDocument(sources, {
    probe: { nonce, checks },
    react: { runtime: await runtime, component: compileComponent(transpiler, sources.jsx) },
  });
  // Quiet: React's warnings and errors reach the report, which is what the gate reads.
  const dom = new JSDOM(doc, { runScripts: 'dangerously', virtualConsole: new VirtualConsole() });
  try {
    const report = await new Promise<ProbeReport>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('The React page did not report within 10 seconds.')),
        REACT_TIMEOUT_MS,
      );
      dom.window.addEventListener('message', (event: MessageEvent) => {
        const message = parsePlaygroundMessage(event.data);
        if (message?.nonce !== nonce) return;
        clearTimeout(timer);
        resolve(message.report);
      });
    });
    return { report, results: evaluateChecks(checks, report.facts) };
  } finally {
    dom.window.close();
  }
}

/** Loads a page into jsdom the way the preview frame would, and probes it. */
export async function probePage(
  sources: PlaygroundSources,
  checks: readonly PlaygroundCheck[],
): Promise<GatedPage> {
  const { jsx } = sources;
  if (jsx !== undefined) return probeReactPage({ ...sources, jsx }, checks);
  const errors: string[] = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => errors.push(error.message));
  // Scripts run only when the step has JavaScript, as the preview's policy allows. The
  // probe itself is evaluated from outside either way.
  const dom = new JSDOM(buildPlaygroundDocument(sources), {
    runScripts: sources.js === undefined ? 'outside-only' : 'dangerously',
    virtualConsole,
  });
  try {
    const { window } = dom;
    if (window.document.readyState !== 'complete') {
      await new Promise<void>((resolve) => window.addEventListener('load', () => resolve()));
    }
    // A script may change the page from a timer set on load; give it a turn.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const probe = window.eval(PROBE_SOURCE) as Probe;
    const report = probe(window.document, window, checks, errors);
    return { report, results: evaluateChecks(checks, report.facts) };
  } finally {
    dom.window.close();
  }
}

function firstFailure(checks: readonly PlaygroundCheck[], results: readonly CheckResult[]): string {
  const index = results.findIndex((result) => !result.passed);
  const check = checks[index];
  const reason = results[index]?.reason;
  return check ? `"${check.label}"${reason ? `: ${reason}` : ''}` : 'unknown';
}

export const jsdomPlaygroundGate: PlaygroundGate = async (lesson, step) => {
  const checks = step.checks;
  if (checks === undefined || step.solution === undefined) return [];
  const issue = (message: string): Issue => ({
    severity: 'error',
    path: lesson.path,
    where: step.id,
    message,
    rule: 'playground-gate',
  });
  const starter = mergeSources({ html: step.html, css: step.css, js: step.js, jsx: step.jsx }, {});

  const issues: Issue[] = [];
  const solved = await probePage(mergeSources(starter, step.solution), checks);
  if (solved.report.errors.length > 0) {
    issues.push(
      issue(`The solution's script throws: ${solved.report.errors[0]}. Fix the solution.`),
    );
  }
  const warning = solved.report.warnings?.[0];
  if (warning !== undefined) {
    issues.push(issue(`React warns about the solution: ${warning}. Fix the solution.`));
  }
  if (!solved.results.every((result) => result.passed)) {
    issues.push(
      issue(
        `The solution does not pass the check ${firstFailure(checks, solved.results)}. Fix the solution or the check.`,
      ),
    );
  }
  const begun = await probePage(starter, checks);
  if (begun.results.every((result) => result.passed)) {
    issues.push(
      issue(
        'The starter already passes every check, so there is nothing to do. Change the starter or add a check it fails.',
      ),
    );
  }
  return issues;
};
