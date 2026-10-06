import type { Issue } from './catalog';
import type { Lesson, Step } from './schema';
import { proseOnly, sentencesOf, wordCount } from './style';

/*
 * The measurable rules of docs/WRITING-GUIDE.md. Every number here is a rule number there.
 *
 * These checks do not judge whether a lesson is good: a lesson can pass every one and still
 * be dull. They catch the patterns that made the first lessons hard to read, so an author
 * spends their attention on the parts no rule can check.
 */
export const READABILITY = {
  /** Rule 3. */
  proseWords: 70,
  /** Rule 7. */
  sentenceWords: 20,
  /** Rule 4. */
  questionWords: 20,
  /**
   * Rules 3 and 4, for a task: a playground prompt says what to change and what to watch,
   * a sql prompt what to find or change.
   */
  taskWords: 40,
  /** Rule 15. Also a playground check label, which reads like a choice. */
  choiceWords: 10,
  /** Rule 16. */
  rightFeedbackWords: 15,
  /** Rule 17. */
  wrongFeedbackWords: 25,
  /** Rule 17. */
  templateAllowance: 2,
  /** Rule 21. */
  exclamationAllowance: 1,
  /** Rule 23. */
  maxSteps: 10,
  /** Rule 23. */
  maxMinutes: 10,
  /** Rule 40. */
  predictSteps: 2,
  /** Rule 40. */
  traceRows: 4,
  /** Rule 41: the share of scored steps that must be active. */
  activeShare: 0.5,
} as const;

// Rule 41. A fill-blank counts only when it fills in real code, not a sentence.
const ACTIVE = new Set(['playground', 'code-challenge', 'bug-hunt', 'ai-review', 'sql', 'parsons']);

/** A lab or incident is scored the way its fallback is, since that is what every client shows. */
function scoredAs(step: Step): Step {
  return step.type === 'lab' || step.type === 'incident' ? (step.fallback as Step) : step;
}

function isScored(step: Step): boolean {
  if (step.type === 'prose') return false;
  // A playground without checks is a sandbox: no score, so it neither helps nor hurts.
  if (step.type === 'playground') return (step.checks ?? []).length > 0;
  return true;
}

function isActive(step: Step): boolean {
  if (step.type === 'fill-blank') return step.language !== 'text';
  return ACTIVE.has(step.type);
}

const TEMPLATE = /\bYou predicted that\b/g;
// A capitalised name followed within a few words by a year, "et al.", or a study size.
const CITATION =
  /\bet al\.|\b[A-Z][a-z]+(?:,? (?:and|&) [A-Z][a-z]+)*(?: and colleagues)?\b[^.]{0,60}\b(?:19|20)\d{2}\b|\b\d+ (?:comparisons|experiments|studies|participants|students)\b/;
const CODE_SIGNS = /[{}();=<>[\]$#/\\|&*+]|=>|^\s*\w+:\s|\b(?:const|let|function|return|SELECT|GET|POST)\b/;

type Where = { where?: string; label: string };

function words(markdown: string): number {
  return wordCount(proseOnly(markdown));
}

function warn(path: string, at: Where, rule: string, message: string): Issue {
  return {
    severity: 'warning',
    path,
    ...(at.where ? { where: at.where } : {}),
    message: `${at.label}: ${message} See docs/WRITING-GUIDE.md.`,
    rule: `readability-${rule}`,
  };
}

/** Every piece of text a learner reads in a step, with a label for the report. */
function textsOf(step: Step): { label: string; text: string }[] {
  const out: { label: string; text: string }[] = [];
  const add = (label: string, text: unknown) => {
    if (typeof text === 'string') out.push({ label, text });
  };
  const s = step as Record<string, unknown>;
  add('body', s.body);
  add('caption', (s.figure as { caption?: unknown } | undefined)?.caption);
  add('question', s.question);
  add('prompt', s.prompt);
  add('intro', s.intro);
  add('modelAnswer', s.modelAnswer);
  if (step.type === 'playground') {
    (step.checks ?? []).forEach((check, i) => add(`checks[${i}].label`, check.label));
  }
  if (step.type === 'playground' || step.type === 'sql') {
    (step.hints ?? []).forEach((hint, i) => add(`hints[${i}]`, hint));
  }
  for (const { key, list } of choiceListsOf(step)) {
    list.forEach((c, i) => {
      add(`${key}[${i}].text`, c.text);
      add(`${key}[${i}].feedback`, c.feedback);
    });
  }
  if (step.type === 'bug-hunt' || step.type === 'ai-review') add('verify.question', step.verify?.question);
  return out;
}

type ChoiceLike = { text: string; feedback: string; correct?: boolean };

/** The lists of choices a learner reads in a step, a verify follow-up's among them. */
function choiceListsOf(step: Step): { key: string; list: ChoiceLike[] }[] {
  const s = step as Record<string, unknown>;
  const lists: { key: string; list: ChoiceLike[] }[] = [];
  for (const key of ['choices', 'reasons'] as const) {
    const list = s[key];
    if (Array.isArray(list)) lists.push({ key, list: list as ChoiceLike[] });
  }
  if ((step.type === 'bug-hunt' || step.type === 'ai-review') && step.verify) {
    lists.push({ key: 'verify.choices', list: step.verify.choices });
  }
  return lists;
}

/** Lines of the code pane that read as sentences: several words and nothing code-like. */
function isProseInCode(step: Step): boolean {
  const s = step as { code?: unknown; language?: unknown };
  if (typeof s.code !== 'string' || s.language !== 'text') return false;
  const lines = s.code.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return false;
  const sentences = lines.filter((line) => wordCount(line) >= 5 && !CODE_SIGNS.test(line));
  return sentences.length / lines.length > 0.5;
}

function stepIssues(step: Step, path: string): Issue[] {
  const issues: Issue[] = [];
  const at = (label: string): Where => ({ where: step.id, label });

  if (step.type === 'prose' && words(step.body) > READABILITY.proseWords) {
    issues.push(warn(path, at('body'), 'prose-long', `${words(step.body)} words. One idea per step, at most ${READABILITY.proseWords} words.`));
  }

  if (step.type === 'playground' || step.type === 'sql') {
    const n = words(step.prompt);
    if (n > READABILITY.taskWords) {
      const task = step.type === 'sql' ? 'what to find or change' : 'what to change and what to watch';
      issues.push(warn(path, at('prompt'), 'task-long', `${n} words. Say ${task} in at most ${READABILITY.taskWords}.`));
    }
  }
  if (step.type === 'playground') {
    (step.checks ?? []).forEach((check, i) => {
      if (words(check.label) > READABILITY.choiceWords) {
        issues.push(warn(path, at(`checks[${i}].label`), 'check-long', `${words(check.label)} words. Keep a check to ${READABILITY.choiceWords}, like a choice.`));
      }
    });
  }

  const s = step as Record<string, unknown>;
  const questions: { label: string; text: string }[] = [];
  if (typeof s.question === 'string') questions.push({ label: 'question', text: s.question });
  if ((step.type === 'bug-hunt' || step.type === 'ai-review') && step.verify) {
    questions.push({ label: 'verify.question', text: step.verify.question });
  }
  for (const { label, text: q } of questions) {
    if (words(q) > READABILITY.questionWords) {
      issues.push(warn(path, at(label), 'question-long', `${words(q)} words. Ask in at most ${READABILITY.questionWords}.`));
    }
    if ((q.match(/\?/g) ?? []).length > 1 || /,\s*and (which|what|who|how|why|when)\b/i.test(q)) {
      issues.push(warn(path, at(label), 'double-question', 'This asks two things. Ask one question per step.'));
    }
  }

  for (const { key, list } of choiceListsOf(step)) {
    list.forEach((c, i) => {
      if (words(c.text) > READABILITY.choiceWords) {
        issues.push(warn(path, at(`${key}[${i}].text`), 'choice-long', `${words(c.text)} words. Keep a choice to ${READABILITY.choiceWords}.`));
      }
      const limit = c.correct ? READABILITY.rightFeedbackWords : READABILITY.wrongFeedbackWords;
      if (words(c.feedback) > limit) {
        issues.push(warn(path, at(`${key}[${i}].feedback`), 'feedback-long', `${words(c.feedback)} words. Feedback for a ${c.correct ? 'right' : 'wrong'} answer has at most ${limit}.`));
      }
    });
  }

  for (const { label, text } of textsOf(step)) {
    if (CITATION.test(proseOnly(text))) {
      issues.push(warn(path, at(label), 'citation', 'Research details belong in references or the deep dive, not in a step.'));
    }
  }

  if (isProseInCode(step)) {
    issues.push(warn(path, at('code'), 'prose-in-code', 'The code pane holds sentences. Put prose in the question, and keep the pane for code or data.'));
  }
  return issues;
}

export function readabilityOf(lesson: Lesson, path: string): Issue[] {
  const issues: Issue[] = [];
  const lessonAt = (label: string): Where => ({ label });

  const all = [
    { where: 'opening', label: 'opening', text: lesson.opening.text },
    ...lesson.steps.flatMap((step) => textsOf(step).map((t) => ({ where: step.id, ...t }))),
    ...(lesson.recap ?? []).map((line) => ({ where: 'recap', label: 'recap', text: line })),
  ];

  for (const { where, label, text } of all) {
    for (const sentence of sentencesOf(text)) {
      const n = wordCount(sentence);
      if (n > READABILITY.sentenceWords) {
        issues.push(warn(path, { where, label }, 'sentence-long', `A sentence has ${n} words. Split it: at most ${READABILITY.sentenceWords}.`));
      }
    }
  }

  // Rule 25: the summary screen shows what the learner can now do.
  if (!lesson.recap) {
    issues.push(warn(path, lessonAt('recap'), 'recap-missing', 'No recap. Add three short lines on what the learner can now do.'));
  }

  for (const step of lesson.steps) issues.push(...stepIssues(step, path));

  const template = all.reduce((n, t) => n + (t.text.match(TEMPLATE) ?? []).length, 0);
  if (template > READABILITY.templateAllowance) {
    issues.push(warn(path, lessonAt('feedback'), 'template', `"You predicted that" appears ${template} times. Vary the feedback; use it at most ${READABILITY.templateAllowance} times.`));
  }

  const exclamations = all.reduce((n, t) => n + (proseOnly(t.text).match(/!/g) ?? []).length, 0);
  if (exclamations > READABILITY.exclamationAllowance) {
    issues.push(warn(path, lessonAt('lesson'), 'exclamation', `${exclamations} exclamation marks. Keep at most ${READABILITY.exclamationAllowance} per lesson.`));
  }

  // Rules 39 to 41: tracing values in your head is not the skill; running and fixing code is.
  const predicts = lesson.steps.filter((step) => step.type === 'predict-output').length;
  if (predicts > READABILITY.predictSteps) {
    issues.push(warn(path, lessonAt('lesson'), 'predict-many', `${predicts} predict-output steps. Keep at most ${READABILITY.predictSteps}; let the learner run the code and ask about the cause or the fix.`));
  }
  for (const step of lesson.steps) {
    const s = scoredAs(step);
    if (s.type === 'trace-table' && s.rows.length > READABILITY.traceRows) {
      issues.push(warn(path, { where: step.id, label: 'rows' }, 'trace-long', `${s.rows.length} rows. A trace table has at most ${READABILITY.traceRows}, and only when the table is the mechanism being taught.`));
    }
  }
  const scored = lesson.steps.map(scoredAs).filter(isScored);
  const active = scored.filter(isActive).length;
  if (scored.length > 0 && active < scored.length * READABILITY.activeShare && lesson.assessment !== true) {
    issues.push(warn(path, lessonAt('lesson'), 'passive', `${active} of ${scored.length} scored steps are active. Make at least half playground, code-challenge, bug-hunt, ai-review, sql, parsons or fill-blank of real code.`));
  }

  // An assessment is long on purpose: its minutes are the time limit of a real test.
  const long = lesson.steps.length > READABILITY.maxSteps || lesson.minutes > READABILITY.maxMinutes;
  if (long && lesson.assessment !== true) {
    issues.push(warn(path, lessonAt('lesson'), 'lesson-long', `${lesson.steps.length} steps, ${lesson.minutes} minutes. One big idea per lesson: at most ${READABILITY.maxSteps} steps and ${READABILITY.maxMinutes} minutes.`));
  }

  return issues;
}
