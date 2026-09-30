/*
 * The hanging indent of a wrapped code line on a phone (docs/MOBILE-EDITING.md, section 8.1).
 * Shared by the build, which writes it into highlighted code, and by the editor, which
 * draws the same indent while the learner types, so the two break lines alike.
 */

/** How far a continued row sits past the line's own indent, in columns. */
export const HANG_COLUMNS = 2;

/** The indent of a line in columns, a tab counted to the next stop. */
export function leadingColumns(text: string, tabSize: number): number {
  let columns = 0;
  for (const char of text) {
    if (char === ' ') columns += 1;
    else if (char === '\t') columns += tabSize - (columns % tabSize);
    else break;
  }
  return columns;
}

/** Where the rows after the first start, in columns from the line's left edge. */
export const hangOf = (text: string, tabSize: number): number =>
  leadingColumns(text, tabSize) + HANG_COLUMNS;
