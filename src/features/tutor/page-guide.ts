/*
 * What Scout says away from a lesson. There is no step to explain on these pages, so Scout
 * is a guide: it helps choose where to start and what each option is for. Each page names
 * itself, says what it offers (sent to the model as the screen) and suggests the questions
 * people ask there. The first matching pattern wins.
 */

export interface PageGuide {
  title: string;
  /** What the page offers, in a sentence or two, for the model. */
  offers: string;
  starters: readonly string[];
}

const GUIDES: ReadonlyArray<readonly [RegExp, PageGuide]> = [
  [
    /^\/$/,
    {
      title: 'Home',
      offers:
        'The front door. A learner can make a plan in 30 seconds (pick a goal, answer two questions, get phases with a step for today) or just start coding. Goals: learn to code from zero, refresh fundamentals, learn a second language, build and ship full-stack, become an AI engineer, get ready for coding interviews, prepare for senior and system design rounds, stay sharp.',
      starters: [
        'Which goal fits me?',
        'I have never coded. Where do I start?',
        'Plan or just start coding?',
        'How much time does this take a week?',
      ],
    },
  ],
  [
    /^\/plan/,
    {
      title: 'Your plan',
      offers:
        'The learner’s plan: phases toward their goal, with one step for today. They can change the goal or the weekly time.',
      starters: [
        'What should I do today?',
        'Can I change my goal later?',
        'What if I miss a week?',
      ],
    },
  ],
  [
    /^\/paths\/.+/,
    {
      title: 'A learning path',
      offers:
        'One learning path: its goal, its stages and the lessons in each stage, with progress.',
      starters: [
        'Is this path right for me?',
        'Can I skip what I already know?',
        'What will I be able to build at the end?',
      ],
    },
  ],
  [
    /^\/paths/,
    {
      title: 'Paths',
      offers:
        'The learning paths: Start coding, JavaScript / TypeScript, Python, Algorithms, AI engineering, AI coding tests and Interview skills. Each is a goal with stages of lessons.',
      starters: [
        'Which path should I start with?',
        'Can I follow two paths at once?',
        'How do paths and the course fit together?',
      ],
    },
  ],
  [
    /^\/learn/,
    {
      title: 'Library',
      offers:
        'The whole course: seven parts and 370 lessons, each part ending with a checkpoint, a small project and a milestone. Nothing is locked. Also lectures to read and fast tracks.',
      starters: [
        'Where should I start?',
        'Can I skip ahead to a later part?',
        'What is a checkpoint for?',
        'Lessons, lectures or a fast track?',
      ],
    },
  ],
  [
    /^\/lectures/,
    {
      title: 'Lectures',
      offers:
        'Every lesson as reading, with audio and a PDF, plus condensed fast tracks for an interview or a refresher.',
      starters: [
        'When should I read a lecture instead of doing the lesson?',
        'Which fast track fits my interview?',
      ],
    },
  ],
  [
    /^\/practise\/online-test/,
    {
      title: 'Coding tests',
      offers:
        'The AI-assisted coding simulator: timed tests like a real online assessment, with a built-in assistant whose conversation the reviewer reads, and a report afterwards.',
      starters: [
        'Which test should I try first?',
        'How is a test scored?',
        'How should I use the assistant during a test?',
      ],
    },
  ],
  [
    /^\/practise/,
    {
      title: 'Review',
      offers: 'Review brings back what is due so it sticks, and practice sets drill a topic.',
      starters: [
        'What should I review today?',
        'How does review choose what I see?',
        'How often should I review?',
      ],
    },
  ],
  [
    /^\/map/,
    {
      title: 'Concept map',
      offers:
        'Every concept in the course and how well the learner knows it, shown by weight: unseen, assumed, practised, solid, fluent. Gaps are marked.',
      starters: [
        'How do I read this map?',
        'Which gap should I close first?',
        'How does a concept become fluent?',
      ],
    },
  ],
  [
    /^\/labs/,
    {
      title: 'Labs',
      offers:
        'Interactive labs that let the learner play with how something works, such as the event loop.',
      starters: ['Which lab should I open first?', 'How do labs fit with the lessons?'],
    },
  ],
  [
    /^\/signal/,
    {
      title: 'News',
      offers: 'A short daily digest of news for software and AI engineers.',
      starters: ['Why does this item matter?', 'Is any of this worth learning now?'],
    },
  ],
  [
    /^\/settings/,
    {
      title: 'Settings',
      offers: 'Theme, weekly goal, sync and data settings.',
      starters: ['How do I set my weekly goal?', 'Where is my progress stored?'],
    },
  ],
];

const FALLBACK: PageGuide = {
  title: 'Understory',
  offers: 'A page in Understory, a course from a first line of code to production systems.',
  starters: ['Where should I start?', 'What can I do on this page?', 'How do I see my progress?'],
};

export function pageGuide(pathname: string): PageGuide {
  return GUIDES.find(([pattern]) => pattern.test(pathname))?.[1] ?? FALLBACK;
}
