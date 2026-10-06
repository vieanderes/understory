/*
 * What Scout says away from a lesson. There is no step to explain on these pages, so Scout
 * is a guide: it helps choose where to start and what each option is for. Each page names
 * itself, says what it offers (sent to the model as the screen) and suggests the questions
 * people ask there. The first matching pattern wins. Where everything else is comes from
 * app-guide.ts, which travels with every question.
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
        'Home answers what to do today: the next step, practice that is due and today’s news. A first visit offers the setup, five questions, or just starting to code.',
      starters: [
        'What should I do today?',
        'I have never coded. Where do I start?',
        'Where is the news?',
        'How do I change my goal?',
      ],
    },
  ],
  [
    /^\/plan/,
    {
      title: 'Your plan',
      offers:
        'The setup and the plan it makes. Five questions: goal, interests, starting point, time a day, and news on Home. The plan is phases toward the goal with one step for today.',
      starters: [
        'Which goal fits me?',
        'What should I do today?',
        'Can I change my answers later?',
      ],
    },
  ],
  [
    /^\/paths\/.+/,
    {
      title: 'A learning path',
      offers:
        'One learning path: its goal, its stages with lessons and tests, and progress. It ends with a final exam and a certificate.',
      starters: [
        'Is this path right for me?',
        'Can I skip what I already know?',
        'How do I make this my current path?',
      ],
    },
  ],
  [
    /^\/paths/,
    {
      title: 'Learn',
      offers:
        'Learn: the current path with its stages, lessons, tests and lectures. Switch path lists all seven paths and Build your own path, where you choose parts, chapters or lessons.',
      starters: [
        'Which path should I follow?',
        'How do I switch path?',
        'Can I build my own path?',
        'Where is the whole course?',
      ],
    },
  ],
  [
    /^\/learn\/build/,
    {
      title: 'Build your own path',
      offers:
        'Choose whole parts, chapters or single lessons from the course and save them as your own path on Learn.',
      starters: ['How many lessons should I pick?', 'Can I change my path later?'],
    },
  ],
  [
    /^\/learn/,
    {
      title: 'The course',
      offers:
        'The whole course in the Library: every lesson in seven parts, with search. Each part ends with a checkpoint, a small project and a milestone. Nothing is locked.',
      starters: [
        'Where should I start?',
        'Can I skip ahead to a later part?',
        'What is a checkpoint for?',
      ],
    },
  ],
  [
    /^\/library/,
    {
      title: 'Library',
      offers:
        'Everything beside the four places: the course, coding tests, lectures, labs, your progress, the news archive, decision records, find your level and every learning path.',
      starters: [
        'What is in the Library?',
        'Lessons, lectures or labs?',
        'How do I find my level?',
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
        'Timed coding tests, part of Practice: every test, training tasks, custom tests and past results. Each runs in a simulator with a built-in assistant whose conversation the reviewer reads, and ends with a report.',
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
      title: 'Practice',
      offers:
        'Practice: choose topics and minutes, then a mixed session that brings back what is due first. Also Sit a timed coding test, and Check one part with a checkpoint or test-out.',
      starters: [
        'What should I practise today?',
        'How long should a session be?',
        'What is a test-out?',
      ],
    },
  ],
  [
    /^\/progress/,
    {
      title: 'Progress',
      offers:
        'What the learner did and how well they hold each concept, for the whole course or one scope: lessons, weekly activity, mastery by weight (unseen, assumed, practised, solid, fluent, gap), test and exam results, and what to work on next.',
      starters: [
        'What should I work on next?',
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
        'Interactive labs that let the learner step through how something works, such as the event loop.',
      starters: ['Which lab should I open first?', 'How do labs fit with the lessons?'],
    },
  ],
  [
    /^\/signal/,
    {
      title: 'News',
      offers:
        'News for software and AI engineers: today’s edition, earlier editions, and week and month digests. The archive holds every edition.',
      starters: [
        'Why does this item matter?',
        'Is any of this worth learning now?',
        'Where are older editions?',
      ],
    },
  ],
  [
    /^\/decisions/,
    {
      title: 'Decision records',
      offers: 'The decision records the learner wrote for their capstone projects.',
      starters: ['What makes a good decision record?'],
    },
  ],
  [
    /^\/settings/,
    {
      title: 'Settings',
      offers:
        'Your goals (the five setup questions again), weekly goal, offline download, export and import of progress, decision records, and erasing everything.',
      starters: ['How do I change my goal?', 'Where is my progress stored?', 'Where is the news?'],
    },
  ],
];

const FALLBACK: PageGuide = {
  title: 'Understory',
  offers: 'A page in Understory, a course from a first line of code to production systems.',
  starters: ['Where should I start?', 'What can I do on this page?', 'What should I do next?'],
};

export function pageGuide(pathname: string): PageGuide {
  return GUIDES.find(([pattern]) => pattern.test(pathname))?.[1] ?? FALLBACK;
}
