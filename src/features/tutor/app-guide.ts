import { LIBRARY, PLACES } from '@/components/layout/nav';
import { REPO_URL } from '@/lib/site';

/*
 * Scout's map of Understory, sent with every question in a lesson or on a page, so "where is
 * the news?" gets an answer on any screen. The places and the library come from the
 * navigation itself (nav.ts), so a renamed or added place reaches Scout without anyone
 * remembering to tell it. Kept to a few hundred tokens: it rides along with every question.
 */

/** What each place holds beyond its one-line hint, keyed by its href in nav.ts. */
const PLACE_DETAIL: Readonly<Record<string, string>> = {
  '/': 'the next step, practice due and today’s news.',
  '/paths':
    'your current path, in stages of lessons, tests and lectures. "Switch path" lists every path and "Build your own path" (/learn/build), where you pick parts, chapters or lessons.',
  '/practise':
    'choose topics and minutes for a mixed session. Also "Sit a timed coding test" (/practise/online-test: every test, training tasks, custom tests, results) and "Check one part" (checkpoints and test-outs).',
  '/signal':
    'today’s edition and earlier ones, with week and month digests. The archive is /signal/archive.',
};

/** The library's shelves, as /library lists them. */
export const LIBRARY_SHELVES: readonly (readonly [label: string, href: string])[] = [
  ['the course, every lesson in 7 parts with search', '/learn'],
  ['coding tests', '/practise/online-test'],
  ['lectures to read, hear or print', '/lectures'],
  ['labs', '/labs'],
  ['your progress: what you have done, what you know and what to work on next', '/progress'],
  ['the news archive', '/signal/archive'],
  ['decision records', '/decisions'],
  [
    'find your level: pick parts and Quick, Balanced or Thorough; the same fixed questions per module for everyone, a harder follow-up after a right answer; a verdict per part, each module strong, basics or gap, and a path; /start?area=<id> checks one part',
    '/start',
  ],
  ['every learning path', '/paths'],
];

export const SETTINGS_HREF = '/settings';

/** What Scout knows about the learner, only from what this browser already holds. */
export interface LearnerSituation {
  /** The plan's goal, when they answered the setup. */
  goal?: string;
  interests: readonly string[];
  path?: {
    name: string;
    done: number;
    total: number;
    next?: { title: string; href: string };
  };
  /** Review cards due now, once the course index has loaded. */
  due?: number;
  lastTest?: { title: string; score: number };
  /** The newest edition, and whether they have opened it. */
  news?: { date: string; read: boolean };
}

export function describeSituation(s: LearnerSituation): string[] {
  const lines: string[] = [];
  lines.push(
    s.goal
      ? `- Goal: ${s.goal}. Change it at /plan?edit.`
      : '- No plan yet. The five setup questions are at /plan.',
  );
  if (s.interests.length > 0) lines.push(`- Interests: ${s.interests.join(', ')}.`);
  if (s.path) {
    const next = s.path.next ? ` Next lesson: ${s.path.next.title} (${s.path.next.href}).` : '';
    lines.push(`- Path: ${s.path.name}, ${s.path.done} of ${s.path.total} lessons done.${next}`);
  } else {
    lines.push('- No path under way. Learn (/paths) shows where to begin.');
  }
  if (s.due !== undefined) {
    lines.push(
      s.due > 0
        ? `- ${s.due} review cards due: Practice (/practise).`
        : '- Nothing due for review.',
    );
  }
  if (s.lastTest) lines.push(`- Last coding test: ${s.lastTest.title}, ${s.lastTest.score}%.`);
  if (s.news) {
    lines.push(
      `- The latest news edition (${s.news.date}) is ${s.news.read ? 'read' : 'unread'}: /signal/${s.news.date}.`,
    );
  }
  return lines;
}

export function buildAppGuide({
  pathname,
  situation,
}: {
  pathname: string;
  situation?: LearnerSituation;
}): string {
  const places = PLACES.map((place, i) => {
    const detail = PLACE_DETAIL[place.href] ?? `${place.hint.toLowerCase()}.`;
    return `${i + 1}. ${place.label} (${place.href}): ${detail}`;
  });
  return [
    'Understory teaches software engineering, from a first line of code to production systems. The course has Parts, Parts have Chapters, Chapters have Lessons. A path has Stages of Lessons and Tests.',
    '',
    `Navigation: ${PLACES.length} places. On a phone they are the tabs at the bottom, in this order; on desktop the rail on the left.`,
    ...places,
    `${LIBRARY.label} (${LIBRARY.href}): ${LIBRARY.hint.toLowerCase()}. On desktop at the foot of the left rail; on a phone the "${LIBRARY.label}" link in the top bar. It holds ${LIBRARY_SHELVES.map(([label, href]) => `${label} (${href})`).join(', ')}.`,
    `Settings (${SETTINGS_HREF}): the gear icon beside ${LIBRARY.label}. Goals (/plan?edit asks the five setup questions again), weekly goal, offline download, export and import progress, erase everything.`,
    'Setup (/plan): five questions: goal, interests, starting point, time a day, news on Home.',
    `GitHub (${REPO_URL}): the branch icon beside Settings, at the foot of the rail on desktop and in the top bar on a phone, opens Understory's code, issues and how to contribute, in a new tab.`,
    'Lessons, sessions and tests open full screen with one way back. Scout AI opens with its button or Command or Ctrl and J, and is off in timed tests, checkpoints and test-outs.',
    'Own paths (/learn/build, "Build your own path" on Learn): the learner ticks parts, chapters or single lessons, or presses "Plan with Scout" there and Scout plans the path with them beside the builder: it asks what they are learning for and how much time they have, drafts a path with its own name, and ticks the lessons. A learner keeps several own paths, each with its own name.',
    '',
    `The learner is on ${pathname}.`,
    ...(situation ? describeSituation(situation) : []),
  ].join('\n');
}
