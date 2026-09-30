import type { LectureBlock, LessonLecture } from './lesson';

/*
 * A lecture as something to listen to. The text goes to a speech model (Kokoro, through
 * scripts/build-audio.ts), so it is plain sentences: code is never read aloud but named in a
 * short cue, symbols become words, and every line ends as a sentence so the voice pauses
 * where the page does. Paragraphs are separated by a blank line.
 */

const LANGUAGE_NAMES: Record<string, string> = {
  js: 'JavaScript',
  ts: 'TypeScript',
  jsx: 'React',
  tsx: 'React',
  python: 'Python',
  sql: 'S Q L',
  html: 'H T M L',
  css: 'C S S',
  bash: 'shell',
  json: 'Jason',
  yaml: 'yaml',
  http: 'H T T P',
};

// Inside inline code only. Longest first, so "===" is read before "==".
const SYMBOLS: readonly [string, string][] = [
  ['!==', ' not triple equals '],
  ['===', ' triple equals '],
  ['!=', ' not equals '],
  ['==', ' double equals '],
  ['=>', ' arrow '],
  ['>=', ' greater than or equal to '],
  ['<=', ' less than or equal to '],
  ['&&', ' and '],
  ['||', ' or '],
  ['??', ' nullish '],
  ['?.', ' optional chain '],
  ['...', ' spread '],
  ['++', ' plus plus '],
  ['**', ' to the power '],
  ['[]', ' empty list '],
  ['{}', ' empty object '],
  ['()', ''],
];

// Words a speech model mispronounces or spells out oddly, in prose and code alike.
const SPOKEN: readonly [RegExp, string][] = [
  [/\bSQL\b/g, 'S Q L'],
  [/\bnginx\b/gi, 'engine X'],
  [/\bkubectl\b/g, 'cube control'],
  [/\bJSON\b/g, 'Jason'],
  [/\bAPIs\b/g, 'A P Is'],
  [/\bAPI\b/g, 'A P I'],
  [/\bLLMs\b/g, 'L L Ms'],
  [/\bLLM\b/g, 'L L M'],
  [/\bURLs?\b/g, 'U R L'],
  [/\bHTML\b/g, 'H T M L'],
  [/\bCSS\b/g, 'C S S'],
  [/\bUI\b/g, 'U I'],
  [/O\(1\)/g, 'O of one'],
  [/O\(n log n\)/g, 'O of n log n'],
  [/O\(log n\)/g, 'O of log n'],
  [/O\(n\^2\)|O\(n²\)/g, 'O of n squared'],
  [/O\(n\)/g, 'O of n'],
  [/\be\.g\./g, 'for example'],
  [/\bi\.e\./g, 'that is'],
  [/\betc\./g, 'and so on'],
  [/\bvs\.?(?=\s)/g, 'versus'],
  [/&/g, ' and '],
  [/→/g, ' to '],
  [/×/g, ' times '],
  [/≤/g, ' at most '],
  [/≥/g, ' at least '],
];

const FENCE = /^(```|~~~)(\w*)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;

function inlineCode(code: string): string {
  let spoken = code;
  for (const [symbol, word] of SYMBOLS) spoken = spoken.split(symbol).join(word);
  return spoken
    .replace(/[`_()]/g, ' ')
    .replace(/[{}[\]<>;$#|\\^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The cue read in place of a code block. */
export function codeCue(language: string): string {
  const name = LANGUAGE_NAMES[language];
  return name
    ? `There is a ${name} example here, in the text.`
    : 'There is a code example here, in the text.';
}

/** Markdown to plain sentences, with code blocks replaced by a cue. */
export function speakMarkdown(md: string): string {
  let text = md.replace(
    FENCE,
    (_whole, _fence, language: string) => `\n\n${codeCue(language)}\n\n`,
  );
  text = text.replace(/`([^`\n]+)`/g, (_whole, code: string) => inlineCode(code));
  text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
  text = text.replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*#{1,6}\s+/gm, '');
  for (const [pattern, word] of SPOKEN) text = text.replace(pattern, word);
  return text
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line && !/[.?!:;,]$/.test(line) ? `${line}.` : line))
    .join('\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth'];
const ordinal = (i: number) => ORDINALS[i] ?? 'Next';

function blockScript(block: LectureBlock): string[] {
  switch (block.kind) {
    case 'explanation':
      return [speakMarkdown(block.body.md)];
    case 'question':
      return [
        `A question. ${speakMarkdown(block.question.md)}`,
        ...(block.code ? [codeCue(block.code.language)] : []),
        `The answer: ${speakMarkdown(block.answer.md)}`,
        speakMarkdown(block.why.md),
      ];
    case 'trace':
      return [
        `A trace exercise. ${speakMarkdown(block.prompt.md)}`,
        'The full trace table is in the text.',
      ];
    case 'completed':
      return [speakMarkdown(block.prompt.md), 'The completed code is in the text.'];
    case 'bug':
      return [
        `Find the bug. ${speakMarkdown(block.prompt.md)}`,
        `The fault is on line ${block.lines.join(' and ')}. ${speakMarkdown(block.answer.md)}`,
        speakMarkdown(block.why.md),
      ];
    case 'exercise':
      return [
        `An exercise. ${speakMarkdown(block.prompt.md)}`,
        ...(block.solution.length > 0 ? ['The full solution is in the text.'] : []),
      ];
    case 'model-answer':
      return [
        `Explain it. ${speakMarkdown(block.prompt.md)}`,
        `A model answer. ${speakMarkdown(block.answer.md)}`,
      ];
  }
}

/** A whole lesson lecture as a script to read aloud, in the order the page shows it. */
export function lessonScript(lecture: LessonLecture, context?: string): string {
  const parts: string[] = [
    `${lecture.title}.${context ? ` ${context}.` : ''}`,
    speakMarkdown(lecture.objective),
    'The big picture.',
    lecture.summary ? speakMarkdown(lecture.summary.md) : speakMarkdown(lecture.opening),
  ];
  if (lecture.remember.length > 0) {
    parts.push('Remember.');
    lecture.remember.forEach((line, i) => parts.push(`${ordinal(i)}. ${speakMarkdown(line.md)}`));
  }
  parts.push('The lesson, step by step.');
  for (const block of lecture.blocks) parts.push(...blockScript(block));
  if (lecture.deeper.length > 0) {
    parts.push('Going deeper.');
    for (const section of lecture.deeper) {
      parts.push(speakMarkdown(section.title.md), speakMarkdown(section.body.md));
    }
  }
  if (lecture.pitfalls.length > 0) {
    parts.push('Common mistakes.');
    for (const pitfall of lecture.pitfalls) parts.push(speakMarkdown(pitfall.md));
  }
  if (lecture.interview.length > 0) {
    parts.push('Interview questions.');
    lecture.interview.forEach((qa, i) => {
      parts.push(
        `Question ${i + 1}. ${speakMarkdown(qa.question.md)}`,
        `Answer. ${speakMarkdown(qa.answer.md)}`,
      );
    });
  }
  if (lecture.flashcards.length > 0) {
    parts.push('Test yourself. Say your answer before you hear mine.');
    for (const card of lecture.flashcards) {
      parts.push(speakMarkdown(card.front.md), `Answer. ${speakMarkdown(card.back.md)}`);
    }
  }
  return parts.filter((part) => part.trim() !== '').join('\n\n');
}
