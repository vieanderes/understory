import type { PathSummary } from '@/lib/content';

export const PATH: PathSummary = {
  id: 'coding-rounds',
  name: 'Coding rounds',
  title: 'Pass the coding rounds',
  promise: 'Solve the problems interviews ask.',
  summary: 'Problems, then patterns.',
  outcomes: ['Solve array problems in linear time', 'Explain a solution while you write it'],
  method: [],
  practice: [],
  shapes: [],
  readyWhen: [],
  proof: { title: 'Ten problems, solved and explained', evidence: [] },
  stages: [
    {
      title: 'Warm up',
      why: 'The basics.',
      lessons: [
        { id: 'c.one', title: 'Arrays', objective: '', minutes: 10, href: '/learn/c/one' },
        { id: 'c.two', title: 'Strings', objective: '', minutes: 10, href: '/learn/c/two' },
      ],
      optional: [],
    },
    {
      title: 'Patterns',
      why: 'The patterns.',
      lessons: [
        {
          id: 'c.three',
          title: 'Two pointers',
          objective: '',
          minutes: 10,
          href: '/learn/c/three',
        },
      ],
      optional: [],
    },
  ],
  lessonIds: ['c.one', 'c.two', 'c.three'],
  minutes: 30,
};
