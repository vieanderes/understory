/*
 * A path's name is interface copy the learner sees on every tab, so it keeps the house rules
 * (AGENTS.md, law 6) whoever wrote it, Scout or the learner: no emoji, no exclamation marks,
 * no em-dashes, and short enough for a tab.
 */

export const MAX_NAME = 48;
export const FALLBACK_NAME = 'My path';

export function cleanPathName(raw: string): string {
  const cleaned = raw
    .replace(/\p{Extended_Pictographic}|️|‍/gu, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/!+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.:;\s]+|[,:;\s]+$/g, '');
  if (!cleaned) return FALLBACK_NAME;
  if (cleaned.length <= MAX_NAME) return cleaned;
  // Cut at a word, so a tab never ends mid-word.
  const cut = cleaned.slice(0, MAX_NAME + 1);
  const space = cut.lastIndexOf(' ');
  return (space > MAX_NAME / 2 ? cut.slice(0, space) : cleaned.slice(0, MAX_NAME)).replace(
    /[,:;\s]+$/,
    '',
  );
}
