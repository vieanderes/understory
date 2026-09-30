/*
 * A lesson step as plain text for the study assistant. Compiled steps keep every piece of
 * prose as `{ md, html }`, whatever the step type, so collecting the markdown finds the
 * prompt, the body, the options and the feedback without a case per step type.
 */

const MAX_CHARS = 8000;

function collect(value: unknown, out: string[], depth: number): void {
  if (depth > 6 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collect(item, out, depth + 1);
    return;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.md === 'string' && typeof record.html === 'string') {
    out.push(record.md);
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    // The answers stay out: the tutor should help the learner reach them, not read them out.
    if (/solution|answer|correct|expected|hidden/i.test(key)) continue;
    if (key === 'starterCode' && typeof child === 'string') out.push(`Starter code:\n${child}`);
    collect(child, out, depth + 1);
  }
}

export function stepText(step: unknown): string {
  const out: string[] = [];
  collect(step, out, 0);
  return out.join('\n\n').slice(0, MAX_CHARS);
}
