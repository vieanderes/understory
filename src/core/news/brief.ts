import {
  CONCEPT_EXPLANATION_MAX_WORDS,
  KEY_CONCEPTS_MAX,
  KEY_CONCEPTS_MIN,
  RECALL_CARDS_MAX,
  RELATED_LESSONS_MAX,
  WHAT_HAPPENED_MAX_WORDS,
  WHY_IT_MATTERS_MAX_WORDS,
  type Brief,
  type GlossaryEntry,
  type Interests,
  type KeyConcept,
  type LessonIndexEntry,
  type NewsItem,
} from './schema';
import {
  collapseWhitespace,
  containsTerm,
  countTerm,
  splitSentences,
  truncateWords,
  wordCount,
} from './text';

/*
 * Two rules for every brief, whoever wrote it:
 *  - `validateBrief` is the gate. A model-written brief that fails it is thrown away.
 *  - `extractiveBrief` is the fallback. It only rearranges what the source and
 *    interests.yaml already say, so it cannot invent a fact.
 */

/** Used when an item has no known topic. States the limit of what is known. */
const NO_TOPIC_WHY = 'It matched your interests. The source does not say more.';

const TITLE_HIT_WEIGHT = 3;

/**
 * First person, as a model or a press release would write it. `I` must not match "I/O",
 * and `us` must not match "US", so those two are case-sensitive and guarded.
 */
const FIRST_PERSON_CASE_SENSITIVE = /(?<![\w/])(?:I|I'm|I've|I'd|I'll|me|us)(?![\w/])/;
const FIRST_PERSON_ANY_CASE = /\b(?:we|we're|we've|we'll|our|ours|ourselves|my|myself)\b/i;

const QUOTED = /"[^"]*"|“[^”]*”/g;
/** Global, so only ever used with `match`. A global regex keeps state across `test` calls. */
const URLS_IN_TEXT = /(?:https?:\/\/|www\.)[^\s"'<>)]+/gi;

function isFirstPerson(text: string): boolean {
  // A quoted headline is the source speaking, not the brief.
  const own = text.replace(QUOTED, ' ');
  return FIRST_PERSON_CASE_SENSITIVE.test(own) || FIRST_PERSON_ANY_CASE.test(own);
}

// ---------------------------------------------------------------------------
// Extractive brief
// ---------------------------------------------------------------------------

function haystack(item: NewsItem): string {
  return `${item.title}\n${item.excerpt ?? ''}`;
}

/** The headline as it can sit inside double quotes in a calm sentence. */
function quotable(title: string): string {
  return collapseWhitespace(title.replace(/["“”]/g, "'").replace(/!+/g, ''));
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function byline(authors: readonly string[]): string | null {
  const [first, second] = authors;
  if (first === undefined) return null;
  if (second === undefined) return first;
  if (authors.length === 2) return `${first} and ${second}`;
  return `${first} and ${plural(authors.length - 1, 'other')}`;
}

/** The sentence frame around the headline. `%` marks where the headline goes. */
function leadFrame(item: NewsItem): string {
  if (item.source.kind === 'arxiv') {
    const who = byline(item.authors ?? []);
    return who === null
      ? 'The paper "%" was posted on arXiv.'
      : `${who} posted the paper "%" on arXiv.`;
  }
  if (item.source.kind === 'hn') {
    const numbers = [
      item.points !== undefined && plural(item.points, 'point'),
      item.comments !== undefined && plural(item.comments, 'comment'),
    ].filter((part): part is string => part !== false);
    const tail = numbers.length > 0 ? ` with ${numbers.join(' and ')}` : '';
    return `"%" reached the Hacker News front page${tail}.`;
  }
  return `${item.source.name} published "%".`;
}

function lead(item: NewsItem): string {
  const frame = leadFrame(item);
  const frameWords = wordCount(frame.replace('%', ''));
  const title = truncateWords(quotable(item.title), WHAT_HAPPENED_MAX_WORDS - frameWords);
  return frame.replace('%', title);
}

/** Sentences of the excerpt a neutral summary can repeat as they are. */
function usableSentences(excerpt: string): string[] {
  const sentences = splitSentences(excerpt);
  const complete = sentences.filter((sentence) => !sentence.endsWith('...'));
  // A cut-off sentence is better than none, but worse than any complete one.
  return (complete.length > 0 ? complete : sentences).filter(
    (sentence) =>
      !isFirstPerson(sentence) &&
      !sentence.includes('!') &&
      (sentence.match(URLS_IN_TEXT) ?? []).length === 0,
  );
}

function whatHappened(item: NewsItem): string {
  let text = lead(item);
  for (const sentence of usableSentences(item.excerpt ?? '')) {
    const next = `${text} ${sentence}`;
    if (wordCount(next) > WHAT_HAPPENED_MAX_WORDS) break;
    text = next;
  }
  return text;
}

function named(entry: GlossaryEntry, text: string): boolean {
  return [entry.term, ...entry.match].some((phrase) => containsTerm(text, phrase));
}

function keyConcepts(item: NewsItem, interests: Interests): KeyConcept[] {
  const text = haystack(item);
  const inText = interests.glossary.filter((entry) => named(entry, text));
  // For each topic: the concepts filed under it first, then those that only touch it.
  const fromTopics = item.topics.flatMap((topic) => [
    ...interests.glossary.filter((entry) => entry.topics[0] === topic),
    ...interests.glossary.filter((entry) => entry.topics.includes(topic)),
  ]);
  // Concepts the text names come first. Topic concepts only fill up to the minimum, so a
  // brief is never padded with terms the story does not touch.
  const chosen = [...new Set(inText)].slice(0, KEY_CONCEPTS_MAX);
  for (const entry of [...fromTopics, ...interests.glossary]) {
    if (chosen.length >= KEY_CONCEPTS_MIN) break;
    if (!chosen.includes(entry)) chosen.push(entry);
  }
  return chosen.map((entry) => ({ term: entry.term, explanation: entry.explanation }));
}

/** Lesson ids whose keywords appear in the item, best match first. */
export function relatedLessons(
  item: NewsItem,
  lessonIndex: readonly LessonIndexEntry[],
  max: number = RELATED_LESSONS_MAX,
): string[] {
  const excerpt = item.excerpt ?? '';
  return lessonIndex
    .map((lesson) => ({
      id: lesson.id,
      hits: lesson.keywords.reduce(
        (sum, keyword) =>
          sum + TITLE_HIT_WEIGHT * countTerm(item.title, keyword) + countTerm(excerpt, keyword),
        0,
      ),
    }))
    .filter((lesson) => lesson.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id))
    .slice(0, max)
    .map((lesson) => lesson.id);
}

/**
 * The brief for a run without an API key, and for any item whose model-written brief was
 * rejected. Built only from the item and from interests.yaml.
 */
export function extractiveBrief(
  item: NewsItem,
  lessonIndex: readonly LessonIndexEntry[],
  interests: Interests,
): Brief {
  const primary = interests.topics.find((topic) => topic.id === item.topics[0]);
  return {
    whatHappened: whatHappened(item),
    whyItMatters: primary?.why ?? NO_TOPIC_WHY,
    keyConcepts: keyConcepts(item, interests),
    relatedLessons: relatedLessons(item, lessonIndex),
    // A paper asks for an hour. A post or a thread is a few minutes.
    readingLevel: item.source.kind === 'arxiv' ? 'deep' : 'quick',
    generatedBy: 'extractive',
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type BriefValidation = { ok: true } | { ok: false; problems: string[] };

function ownUrls(item: NewsItem): string[] {
  return [item.url, item.canonicalUrl, item.discussionUrl].filter(
    (url): url is string => url !== undefined,
  );
}

function hasForeignUrl(text: string, item: NewsItem): boolean {
  const allowed = ownUrls(item);
  return (text.match(URLS_IN_TEXT) ?? [])
    .map((url) => url.replace(/[.,;:!?]+$/, ''))
    .some((url) => !allowed.includes(url));
}

/** Every piece of prose in a brief, with the name used in problem messages. */
function proseFields(brief: Brief): [name: string, text: string][] {
  return [
    ['whatHappened', brief.whatHappened],
    ['whyItMatters', brief.whyItMatters],
    ['keyConcepts', brief.keyConcepts.map((c) => `${c.term}. ${c.explanation}`).join(' ')],
    ['recallCards', (brief.recallCards ?? []).map((c) => `${c.front} ${c.back}`).join(' ')],
  ];
}

function overLimit(name: string, text: string, limit: number): string[] {
  const count = wordCount(text);
  return count > limit ? [`${name} has ${count} words, the limit is ${limit}.`] : [];
}

/**
 * The house rules a brief must meet before it is stored. The schema checks shape. This
 * checks content: limits, links to real lessons, no smuggled URLs, and the writing rules
 * of the app (no first person, no exclamation marks).
 */
export function validateBrief(
  brief: Brief,
  item: NewsItem,
  lessonIndex: readonly LessonIndexEntry[],
): BriefValidation {
  const problems: string[] = [
    ...overLimit('whatHappened', brief.whatHappened, WHAT_HAPPENED_MAX_WORDS),
    ...overLimit('whyItMatters', brief.whyItMatters, WHY_IT_MATTERS_MAX_WORDS),
    ...brief.keyConcepts.flatMap((concept) =>
      overLimit(
        `The explanation of "${concept.term}"`,
        concept.explanation,
        CONCEPT_EXPLANATION_MAX_WORDS,
      ),
    ),
  ];

  const concepts = brief.keyConcepts.length;
  if (concepts < KEY_CONCEPTS_MIN || concepts > KEY_CONCEPTS_MAX) {
    problems.push(
      `keyConcepts has ${concepts} entries, it needs ${KEY_CONCEPTS_MIN} to ${KEY_CONCEPTS_MAX}.`,
    );
  }
  const cards = brief.recallCards?.length ?? 0;
  if (cards > RECALL_CARDS_MAX) {
    problems.push(`recallCards has ${cards} entries, the limit is ${RECALL_CARDS_MAX}.`);
  }

  const known = new Set(lessonIndex.map((lesson) => lesson.id));
  for (const id of brief.relatedLessons) {
    if (!known.has(id)) problems.push(`relatedLessons names the unknown lesson "${id}".`);
  }

  for (const [name, text] of proseFields(brief)) {
    if (hasForeignUrl(text, item)) problems.push(`${name} holds a URL that is not the item’s.`);
    if (isFirstPerson(text)) problems.push(`${name} is written in the first person.`);
    if (text.includes('!')) problems.push(`${name} holds an exclamation mark.`);
  }

  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}
