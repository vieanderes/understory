import type { PlanGoal } from '@/core/plan';

/*
 * What a learner said they care about (profile_set). Interests narrow the practice topics
 * offered first and order the news; they never lock anything away, and an empty list means
 * "everything".
 */

export const INTERESTS = [
  'basics',
  'web',
  'typescript',
  'python',
  'backend',
  'algorithms',
  'ai',
  'systems',
  'interviews',
] as const;
export type Interest = (typeof INTERESTS)[number];

export interface InterestCopy {
  label: string;
  /** Course module ids, the prefix of a lesson id ("python" in "python.functions"). */
  modules: readonly string[];
  /** Signal topic ids this interest follows. */
  news: readonly string[];
}

export const INTEREST_COPY: Record<Interest, InterestCopy> = {
  basics: { label: 'Coding basics', modules: ['basics', 'cs', 'clean'], news: [] },
  web: {
    label: 'Web and React',
    modules: ['html', 'css', 'react', 'next', 'nextserver', 'design'],
    news: ['web-platform'],
  },
  typescript: {
    label: 'JavaScript and TypeScript',
    modules: ['js', 'ts', 'tooling', 'pro'],
    news: ['dev-tooling', 'web-platform'],
  },
  python: { label: 'Python', modules: ['python', 'pyai'], news: [] },
  backend: {
    label: 'Servers and data',
    modules: ['backend', 'db', 'security', 'testing'],
    news: ['databases', 'security'],
  },
  algorithms: { label: 'Algorithms', modules: ['algo', 'cs'], news: [] },
  ai: {
    label: 'AI engineering',
    modules: ['ai', 'aisys', 'pyai'],
    news: ['ai-agents', 'llm-research'],
  },
  systems: {
    label: 'System design',
    modules: ['sysdesign', 'scale', 'arch', 'cloud', 'perf', 'atlas'],
    news: ['distributed-systems'],
  },
  interviews: { label: 'Interviews', modules: ['interview', 'career'], news: [] },
};

const moduleOf = (lessonId: string) => lessonId.split('.')[0] ?? lessonId;

export function matchesInterests(lessonId: string, interests: readonly Interest[]): boolean {
  if (interests.length === 0) return true;
  const prefix = moduleOf(lessonId);
  return interests.some((id) => INTEREST_COPY[id].modules.includes(prefix));
}

/** 0 for a followed topic, 1 otherwise: a stable sort key that keeps the edition's order. */
export function newsTopicRank(topic: string, interests: readonly Interest[]): number {
  return interests.some((id) => INTEREST_COPY[id].news.includes(topic)) ? 0 : 1;
}

const GOAL_INTERESTS: Record<PlanGoal, readonly Interest[]> = {
  'from-zero': ['basics', 'web'],
  refresh: ['typescript', 'algorithms'],
  'second-language': ['typescript', 'python'],
  builder: ['web', 'backend'],
  'ai-engineer': ['ai', 'python'],
  interviews: ['algorithms', 'interviews'],
  senior: ['systems', 'interviews'],
  'stay-sharp': ['typescript', 'algorithms'],
};

/** The interests a goal implies, offered as the starting selection. */
export function interestsForGoal(goal: PlanGoal): readonly Interest[] {
  return GOAL_INTERESTS[goal];
}
