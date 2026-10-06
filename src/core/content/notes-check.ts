import { LAB_INFO_BY_ID } from '@/core/labs/catalog';
import { allLessons } from './catalog';
import type { Issue, RawCatalog } from './catalog';
import { languageSchema } from './schema';
import type { CapstoneSolution, FastTrack, Guide, LessonNotes } from './notes';
import {
  bannedWordsIn,
  EM_DASH,
  fencesOf,
  hasRawHtml,
  proseOnly,
  sentencesOf,
  withdrawnSettingTermsIn,
  wordCount,
} from './style';

/*
 * The voice and markdown rules of docs/LECTURE-BRIEF.md, for notes and capstone solutions.
 * Length is not checked: a lecture is meant to be read at length, unlike a lesson screen.
 */

const EN_DASH = String.fromCharCode(0x2013);

interface Field {
  where: string;
  text: string;
}

function notesFields(notes: LessonNotes): Field[] {
  return [
    { where: 'summary', text: notes.summary },
    ...notes.remember.map((text, i) => ({ where: `remember ${i + 1}`, text })),
    ...notes.sections.flatMap((section, i) => [
      { where: `sections ${i + 1} title`, text: section.title },
      { where: `sections ${i + 1} (${section.title})`, text: section.body },
    ]),
    ...(notes.pitfalls ?? []).map((text, i) => ({ where: `pitfalls ${i + 1}`, text })),
    ...(notes.verify ?? []).map(({ check }, i) => ({ where: `verify ${i + 1}`, text: check })),
    ...(notes.interview ?? []).flatMap((qa, i) => [
      { where: `interview ${i + 1} question`, text: qa.question },
      { where: `interview ${i + 1} answer`, text: qa.answer },
    ]),
  ];
}

function capstoneFields(solution: CapstoneSolution): Field[] {
  return [
    { where: 'summary', text: solution.summary },
    ...solution.remember.map((text, i) => ({ where: `remember ${i + 1}`, text })),
    ...solution.sections.flatMap((section, i) => [
      { where: `sections ${i + 1} title`, text: section.title },
      { where: `sections ${i + 1} (${section.title})`, text: section.body },
    ]),
    ...solution.checklist.map((text, i) => ({ where: `checklist ${i + 1}`, text })),
  ];
}

const FENCE = /^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm;
const KNOWN_LANGUAGES = new Set<string>(languageSchema.options);

/** One field's problems, as messages for the author. */
export function lectureTextProblems(text: string): { rule: string; message: string }[] {
  const problems: { rule: string; message: string }[] = [];
  const prose = proseOnly(text);
  if (prose.includes(EM_DASH) || prose.includes(` ${EN_DASH} `)) {
    problems.push({
      rule: 'lecture-dash',
      message: 'Replace the dash with a comma, a colon or two sentences.',
    });
  }
  if (/!(?!\[)/.test(prose.replace(/!=/g, ''))) {
    problems.push({
      rule: 'lecture-exclamation',
      message: 'Remove the exclamation mark. Calm text needs none.',
    });
  }
  const banned = bannedWordsIn(text).filter((word) => word.toLowerCase() !== 'just');
  if (banned.length > 0) {
    problems.push({
      rule: 'lecture-banned-word',
      message: `Cut or replace ${banned.map((word) => `"${word}"`).join(', ')}.`,
    });
  }
  if (hasRawHtml(text)) {
    problems.push({
      rule: 'lecture-raw-html',
      message: 'Raw HTML is not rendered. Put tags in backticks or a fenced block.',
    });
  }
  const outsideFences = text.replace(FENCE, '');
  if (/^ {0,3}#{1,6}\s/m.test(outsideFences)) {
    problems.push({
      rule: 'lecture-heading',
      message: 'A body has no headings. Split it into another section with its own title.',
    });
  }
  if (/^\s*\|.*\|\s*$/m.test(outsideFences)) {
    problems.push({
      rule: 'lecture-table',
      message: 'Tables are not supported. Use a list, or a fenced text block.',
    });
  }
  for (const fence of fencesOf(text)) {
    if (!KNOWN_LANGUAGES.has(fence.language)) {
      problems.push({
        rule: 'lecture-fence-language',
        message: `Give the fence a known language (${[...KNOWN_LANGUAGES].join(', ')}), not "${fence.language || 'nothing'}".`,
      });
    }
  }
  const withdrawn = withdrawnSettingTermsIn(text);
  if (withdrawn.length > 0) {
    problems.push({
      rule: 'lecture-withdrawn-setting',
      message: `Examples are generic. Replace "${withdrawn.join('", "')}".`,
    });
  }
  return problems;
}

function check(path: string, fields: Field[]): Issue[] {
  return fields.flatMap(({ where, text }) =>
    lectureTextProblems(text).map(({ rule, message }) => ({
      severity: 'error' as const,
      rule,
      path,
      where,
      message,
    })),
  );
}

/** A before-you-ship check is read as one line of a checklist. */
const VERIFY_CHECK_WORDS = 30;

function verifyProblems(path: string, notes: LessonNotes): Issue[] {
  return (notes.verify ?? []).flatMap(({ check: text }, i): Issue[] => {
    const issue = (rule: string, message: string): Issue => ({
      severity: 'error',
      rule,
      path,
      where: `verify ${i + 1}`,
      message,
    });
    const words = wordCount(proseOnly(text));
    if (words > VERIFY_CHECK_WORDS) {
      return [issue('notes-verify-long', `${words} words. Say the check in ${VERIFY_CHECK_WORDS} or fewer.`)];
    }
    if (sentencesOf(text).length > 1) {
      return [issue('notes-verify-sentences', 'A check is one sentence. Keep the one that says what to do.')];
    }
    return [];
  });
}

export const checkNotes = (path: string, notes: LessonNotes): Issue[] => [
  ...check(path, notesFields(notes)),
  ...verifyProblems(path, notes),
];

export const checkCapstoneSolution = (path: string, solution: CapstoneSolution): Issue[] =>
  check(path, capstoneFields(solution));

export const checkGuide = (path: string, guide: Guide): Issue[] =>
  check(path, [
    { where: 'summary', text: guide.summary },
    ...guide.sections.flatMap((section, i) => [
      { where: `sections ${i + 1} title`, text: section.title },
      { where: `sections ${i + 1} (${section.title})`, text: section.body },
    ]),
  ]);

/** Every notes file and capstone solution in the catalog, and capstones matched to parts. */
export function validateLectures(catalog: RawCatalog): Issue[] {
  const course = catalog.course;
  if (!course) return [];
  const partIds = new Set((course.data.parts ?? []).map((part) => part.id));
  const capstones = Object.entries(course.capstones ?? {});
  return [
    ...allLessons(catalog).flatMap(({ lesson }) =>
      lesson.notes ? checkNotes(lesson.notes.path, lesson.notes.data) : [],
    ),
    ...capstones.flatMap(([partId, { path, data }]) => [
      ...(partIds.has(partId)
        ? []
        : [
            {
              severity: 'error' as const,
              rule: 'capstone-unknown-part',
              path,
              message: `No part has the id "${partId}". Name the file after a part id in course.yaml.`,
            },
          ]),
      ...checkCapstoneSolution(path, data),
    ]),
    ...Object.values(course.guides ?? {}).flatMap(({ path, data }) => checkGuide(path, data)),
  ];
}

/** The fast track names real lessons with notes, each once, and real parts for capstones. */
/** The ids a stage test may name: presets and training tasks in content/online-tests. */
export interface OnlineTestIds {
  presets: ReadonlySet<string>;
  tasks: ReadonlySet<string>;
  /** Lab ids that should each sit on a stage; none in a fixture tree. */
  labs?: ReadonlySet<string>;
}

const NO_ONLINE_TESTS: OnlineTestIds = { presets: new Set(), tasks: new Set() };

export function validateFastTrack(
  catalog: RawCatalog,
  path: string,
  plan: FastTrack,
  onlineTests: OnlineTestIds = NO_ONLINE_TESTS,
): Issue[] {
  const withNotes = new Map(
    allLessons(catalog).map(({ lesson }) => [lesson.data.id, lesson.notes !== undefined]),
  );
  const partIds = new Set((catalog.course?.data.parts ?? []).map((part) => part.id));
  const guideIds = new Set(Object.keys(catalog.course?.guides ?? {}));
  const seen = new Set<string>();
  const seenTests = new Set<string>();
  const issue = (rule: string, where: string, message: string): Issue => ({
    severity: 'error',
    rule,
    path,
    where,
    message,
  });
  const unknownGuides = plan.guides
    .filter((id) => !guideIds.has(id))
    .map((id) => issue('fast-track-unknown-guide', 'guides', `No guide has the id "${id}".`));
  return [...unknownGuides, ...plan.days.flatMap((day) => [
    ...[...day.must, ...day.should].flatMap((id) => {
      const found: Issue[] = [];
      if (!withNotes.has(id)) {
        found.push(issue('fast-track-unknown-lesson', day.title, `No lesson has the id "${id}".`));
      } else if (!withNotes.get(id)) {
        found.push(
          issue('fast-track-no-notes', day.title, `"${id}" has no notes.yaml, so it has nothing to show.`),
        );
      }
      if (seen.has(id)) {
        found.push(issue('fast-track-duplicate', day.title, `"${id}" is listed twice. Keep one.`));
      }
      seen.add(id);
      return found;
    }),
    ...(day.capstone === undefined || partIds.has(day.capstone)
      ? []
      : [issue('fast-track-unknown-part', day.title, `No part has the id "${day.capstone}".`)]),
    ...day.tests.flatMap((ref) => {
      const found: Issue[] = [];
      const [kind, id] =
        'test' in ref
          ? ['test', ref.test]
          : 'task' in ref
            ? ['task', ref.task]
            : 'lab' in ref
              ? ['lab', ref.lab]
              : ['lesson', ref.lesson];
      if (kind === 'test' && !onlineTests.presets.has(id)) {
        found.push(issue('fast-track-unknown-test', day.title, `No preset test has the id "${id}".`));
      } else if (kind === 'task' && !onlineTests.tasks.has(id)) {
        found.push(issue('fast-track-unknown-task', day.title, `No training task has the id "${id}".`));
      } else if (kind === 'lab' && !LAB_INFO_BY_ID.has(id)) {
        found.push(issue('fast-track-unknown-lab', day.title, `No lab has the id "${id}".`));
      } else if (kind === 'lesson' && !withNotes.has(id)) {
        found.push(issue('fast-track-unknown-lesson', day.title, `No lesson has the id "${id}".`));
      }
      const key = `${kind}:${id}`;
      if (seenTests.has(key)) {
        found.push(issue('fast-track-duplicate-test', day.title, `"${id}" is listed twice. Keep one.`));
      }
      seenTests.add(key);
      return found;
    }),
  ])];
}

/**
 * Every timed test belongs to at least one path stage, so the paths stay the front door to
 * all of them. A warning, so a new task can land before it finds its stage.
 */
export function validateTestsOnPaths(
  plans: readonly FastTrack[],
  onlineTests: OnlineTestIds,
): Issue[] {
  const refs = plans.flatMap((plan) => plan.days.flatMap((day) => day.tests));
  const placed = new Set(
    refs.map((ref) =>
      'test' in ref
        ? `test:${ref.test}`
        : 'task' in ref
          ? `task:${ref.task}`
          : 'lab' in ref
            ? `lab:${ref.lab}`
            : '',
    ),
  );
  const warn = (message: string): Issue => ({
    severity: 'warning',
    rule: 'online-test-off-path',
    path: 'content/tracks',
    where: 'tests',
    message,
  });
  return [
    ...[...onlineTests.presets]
      .filter((id) => !placed.has(`test:${id}`))
      .map((id) => warn(`No path stage lists the test "${id}".`)),
    ...[...onlineTests.tasks]
      .filter((id) => !placed.has(`task:${id}`))
      .map((id) => warn(`No path stage lists the training task "${id}".`)),
    // Labs too: a learner following a path should meet every one of them.
    ...[...(onlineTests.labs ?? [])]
      .filter((id) => !placed.has(`lab:${id}`))
      .map((id) => warn(`No path stage lists the lab "${id}".`)),
  ];
}
