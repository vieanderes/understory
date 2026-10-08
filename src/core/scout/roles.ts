/*
 * Scout's five roles (docs/SCOUT-ROLES.md): Advisor, Librarian, Tutor, Editor, Roommate.
 * There is no role switch in the panel. Where the question was asked decides which roles'
 * rules go into the prompt, so each prompt stays short and Scout takes fewer wrong turns.
 */

export type ScoutRole = 'advisor' | 'librarian' | 'tutor' | 'editor' | 'roommate';

/**
 * Where a question comes from: the path planner, a button that sends the learner's own work,
 * "Ask Scout" after a wrong answer or a failing run, a question typed in a lesson or on any
 * other page, and the online test, where Scout is the assessment's assistant instead.
 */
export const SCOUT_ENTRIES = ['planner', 'work', 'stuck', 'lesson', 'page', 'test'] as const;
export type ScoutEntry = (typeof SCOUT_ENTRIES)[number];

export interface ScoutRoles {
  roles: readonly ScoutRole[];
  /** The role to take when the question does not point to another. */
  lead?: ScoutRole;
}

const ROLES: Record<ScoutEntry, ScoutRoles> = {
  planner: { roles: ['advisor'], lead: 'advisor' },
  work: { roles: ['editor'], lead: 'editor' },
  stuck: { roles: ['tutor'], lead: 'tutor' },
  lesson: { roles: ['tutor', 'librarian', 'roommate'], lead: 'tutor' },
  page: { roles: ['librarian'] },
  test: { roles: [] },
};

export function scoutRoles(entry: ScoutEntry): ScoutRoles {
  return ROLES[entry];
}

type Mode = 'test' | 'tutor' | 'guide' | 'planner';

const ENTRY_OF_MODE: Record<Mode, ScoutEntry> = {
  test: 'test',
  tutor: 'lesson',
  guide: 'page',
  planner: 'planner',
};

/**
 * The entry a request speaks for. The tab names it when a button asked; otherwise the mode
 * implies it. The assessment is never given a study role, whatever the tab says.
 */
export function entryOf(context: { mode?: Mode; entry?: ScoutEntry }): ScoutEntry {
  const mode = context.mode ?? 'test';
  if (mode === 'test') return 'test';
  return context.entry ?? ENTRY_OF_MODE[mode];
}

export interface RoleRules {
  /** When to take the role, for prompts that carry more than one. */
  when: string;
  rules: readonly string[];
}

/*
 * The rules of the roles taken inside the panel. The Advisor plans in its own prompt
 * (PLANNER_RULES); the other roles gain theirs as they are built.
 */
export const ROLE_RULES: Partial<Record<ScoutRole, RoleRules>> = {
  tutor: {
    when: 'the learner is unsure about the lesson or the step on screen',
    rules: [
      'Explain clearly and concretely for someone who may be new to the idea.',
      'Start with the one-sentence answer, then one small example, then stop. Offer to go deeper rather than writing an essay.',
      'Use Markdown. Put code in fenced blocks with the language named (```ts, ```python). Keep examples short and runnable.',
      'If the learner is working on an exercise, help them think it through first: a hint, then a nudge, and the full answer when they ask for it.',
    ],
  },
};

const TITLE: Record<ScoutRole, string> = {
  advisor: 'Advisor',
  librarian: 'Librarian',
  tutor: 'Tutor',
  editor: 'Editor',
  roommate: 'Roommate',
};

/** The rules for an entry's roles, as prompt text; empty when none of them has rules. */
export function roleRules(
  entry: ScoutEntry,
  table: Partial<Record<ScoutRole, RoleRules>> = ROLE_RULES,
): string {
  const { roles, lead } = scoutRoles(entry);
  const present = roles.flatMap((role) => {
    const found = table[role];
    return found ? [{ role, ...found }] : [];
  });
  const [only] = present;
  if (!only) return '';
  if (present.length === 1) return only.rules.join('\n');
  return [
    'You take one of these roles per reply. Take the one that fits the question:',
    ...present.map(({ role, when }) => `- ${TITLE[role]}: when ${when}.`),
    ...(lead && present.some((p) => p.role === lead)
      ? [`When unsure, be the ${TITLE[lead]}.`]
      : []),
    ...present.flatMap(({ role, rules }) => ['', `As the ${TITLE[role]}:`, ...rules]),
  ].join('\n');
}
