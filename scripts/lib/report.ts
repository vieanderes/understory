import type { Issue } from '../../src/core/content/catalog';

/* Turns issues into the text the validator prints. Pure, so the layout is unit-tested. */

export interface ReportOptions {
  /** ANSI colour. On for a terminal, off for CI logs and tests. */
  colour: boolean;
  /** In strict mode a warning fails the run, and the summary says so. */
  strict: boolean;
  /** How many content files were read. */
  checked: number;
}

const paint = (code: number, on: boolean) => (text: string) =>
  on ? `\x1b[${code}m${text}\x1b[0m` : text;

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;

function byFile(issues: readonly Issue[]): Map<string, Issue[]> {
  const groups = new Map<string, Issue[]>();
  for (const issue of issues) groups.set(issue.path, [...(groups.get(issue.path) ?? []), issue]);
  return groups;
}

/** Errors first, because they block the build and warnings do not. */
const errorsFirst = (a: Issue, b: Issue): number =>
  Number(a.severity === 'warning') - Number(b.severity === 'warning');

export function formatReport(issues: readonly Issue[], options: ReportOptions): string {
  const red = paint(31, options.colour);
  const yellow = paint(33, options.colour);
  const green = paint(32, options.colour);
  const bold = paint(1, options.colour);
  const dim = paint(2, options.colour);
  const files = `${plural(options.checked, 'file')} checked`;

  if (issues.length === 0) return `${green(`${files}: no problems.`)}\n`;

  const lines: string[] = [];
  for (const [file, group] of byFile(issues)) {
    lines.push(bold(file));
    for (const issue of [...group].sort(errorsFirst)) {
      const label = issue.severity === 'error' ? red('error  ') : yellow('warning');
      const where = issue.where ? `${issue.where}: ` : '';
      lines.push(`  ${label}  ${where}${issue.message} ${dim(`[${issue.rule}]`)}`);
    }
    lines.push('');
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const strictNote = options.strict && warnings > 0 ? ' Warnings fail the run under --strict.' : '';
  lines.push(`${files}: ${plural(errors, 'error')}, ${plural(warnings, 'warning')}.${strictNote}`);
  return `${lines.join('\n')}\n`;
}

export function exitCodeFor(issues: readonly Issue[], strict: boolean): 0 | 1 {
  const failing = issues.some((issue) => issue.severity === 'error' || strict);
  return failing ? 1 : 0;
}
