import type { CapstoneAdr, ProgressState } from '../progress';

/*
 * The ADR log (LEARNING-SCIENCE.md, C, "Collectibles that are knowledge"): one
 * architecture decision record per capstone, in the shape of Nygard's "Documenting
 * Architecture Decisions" (2011) with MADR's considered options as alternatives. The
 * records are events; the log and its Markdown are derived when asked for, so nothing
 * here is stored and a sync merge cannot duplicate a record.
 */

/** A part as the log needs it, in course order. */
export interface AdrPart {
  readonly id: string;
  readonly title: string;
  readonly capstone: { readonly title: string };
}

export interface AdrEntry {
  /** The part's place in the course, from 1. A record keeps its number when an earlier
   * part's record is written later, so a reference to "ADR 0003" never goes stale. */
  readonly number: number;
  readonly partId: string;
  readonly partTitle: string;
  readonly capstoneTitle: string;
  readonly capstoneBuilt: boolean;
  readonly adr: CapstoneAdr;
}

/** The current record of one part, or undefined when none is written. `number` is the
 * part's place in the course, from 1. */
export function adrEntry(
  state: ProgressState,
  part: AdrPart,
  number: number,
): AdrEntry | undefined {
  const adr = state.capstoneAdrs[part.id];
  if (!adr) return undefined;
  return {
    number,
    partId: part.id,
    partTitle: part.title,
    capstoneTitle: part.capstone.title,
    capstoneBuilt: state.completedCapstones.has(part.id),
    adr,
  };
}

/** The current record of every part that has one, in part order. A record for a part
 * that is no longer in the course is left out. */
export function adrLog(state: ProgressState, parts: readonly AdrPart[]): AdrEntry[] {
  return parts.flatMap((part, index) => adrEntry(state, part, index + 1) ?? []);
}

const pad = (n: number): string => String(n).padStart(4, '0');

/** A heading is one line, however the title was typed. */
const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

const body = (text: string): string => text.replace(/\r\n?/g, '\n').trim();

/** One record as Markdown. `depth` is the level of its title, so the same record can
 * stand alone (1) or sit inside the log or a milestone file (2, 3). */
export function adrMarkdown(entry: AdrEntry, depth = 1): string {
  const h = (level: number) => '#'.repeat(depth + level);
  const { adr } = entry;
  const section = (title: string, text: string | undefined): string[] =>
    text === undefined ? [] : [`${h(1)} ${title}`, '', body(text), ''];
  return [
    `${h(0)} ADR ${pad(entry.number)}: ${oneLine(adr.title)}`,
    '',
    '- Status: Accepted',
    `- Date: ${adr.updatedOn}`,
    `- Capstone: ${entry.capstoneTitle} (Part ${entry.number}, ${entry.partTitle})`,
    '',
    ...section('Context', adr.context),
    ...section('Decision', adr.decision),
    ...section('Alternatives considered', adr.alternatives),
    ...section('Consequences', adr.consequences),
  ].join('\n');
}

/** `adr-0003-servers.md`, numbered the way adr-tools numbers its files. */
export function adrFileName(entry: AdrEntry): string {
  return `adr-${pad(entry.number)}-${entry.partId}.md`;
}

/** Every record in one file, for the portfolio. `date` is the learner's `YYYY-MM-DD`. */
export function adrLogMarkdown(entries: readonly AdrEntry[], date: string): string {
  const count =
    entries.length === 0
      ? 'No decision records yet.'
      : `${entries.length} ${entries.length === 1 ? 'decision' : 'decisions'}, one per capstone. Exported on ${date}.`;
  return [
    '# Architecture decision records',
    '',
    count,
    '',
    ...entries.map((entry) => adrMarkdown(entry, 2)),
  ].join('\n');
}
