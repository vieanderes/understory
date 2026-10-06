import { describe, expect, it } from 'vitest';
import {
  addGaps,
  cleanPathName,
  draftFacts,
  draftFromBlock,
  FALLBACK_NAME,
  fixOrder,
  MAX_NAME,
  parseAskBlock,
  parsePathBlock,
  pathPace,
  plannerCatalog,
  removeLesson,
  removeStage,
  renameDraft,
  scoutBlocks,
  type Draft,
  type PathBlock,
  type PlannerCourse,
} from '@/core/planner';

const lesson = (id: string, minutes = 10, prerequisites: string[] = []) => ({
  id,
  title: `Title ${id}`,
  objective: `Do ${id}.`,
  level: 'essential' as const,
  minutes,
  prerequisites,
});

const COURSE: PlannerCourse = {
  modules: [
    {
      id: 'basics',
      number: 1,
      title: 'Basics',
      summary: 'Values and functions.',
      youCanBuild: 'A tip calculator.',
      lessons: [lesson('basics.values'), lesson('basics.functions', 15, ['basics.values'])],
    },
    {
      id: 'web',
      number: 2,
      title: 'Web',
      summary: 'HTTP.',
      youCanBuild: 'An API.',
      lessons: [
        lesson('web.http', 20, ['basics.functions']),
        lesson('web.rest', 25, ['web.http', 'ghost.lesson']),
      ],
    },
    {
      id: 'woven',
      number: 3,
      title: 'Woven',
      summary: 'Across the course.',
      youCanBuild: 'Habits.',
      lessons: [lesson('woven.git', 5)],
    },
  ],
  parts: [
    { id: 'foundations', title: 'Foundations', summary: 'The ground.', modules: ['basics', 'web'] },
  ],
};

const block = (stages: PathBlock['stages'], extra: Partial<PathBlock> = {}): PathBlock => ({
  name: 'Backend in six weeks',
  alternatives: [],
  summary: '',
  stages,
  ...extra,
});

const stage = (title: string, lessons: string[]) => ({ title, why: '', lessons });

describe('Scout blocks', () => {
  it('reads an ask block and fills the defaults', () => {
    expect(parseAskBlock('{"question":"Why?","options":["A","B"]}')).toEqual({
      question: 'Why?',
      options: ['A', 'B'],
      multi: false,
    });
  });

  it('drops a block that is not JSON or breaks the limits', () => {
    expect(parseAskBlock('{"question":"Why?"')).toBeNull();
    expect(parseAskBlock('{"question":"Why?","options":["only one"]}')).toBeNull();
    expect(parsePathBlock('{"name":"x","stages":[]}')).toBeNull();
    const tooMany = Array.from({ length: 13 }, (_, i) => stage(`S${i}`, ['basics.values']));
    expect(parsePathBlock(JSON.stringify({ name: 'x', stages: tooMany }))).toBeNull();
  });

  it('keeps extra keys out of the way and the prose readable', () => {
    const text = [
      'Here is a first draft.',
      '```scout-path',
      JSON.stringify({ name: 'One', stages: [stage('A', ['basics.values'])], colour: 'red' }),
      '```',
      'Anything to change?',
      '```scout-ask',
      '{"question":"Shorter?","options":["Yes","No"],"multi":false}',
      '```',
    ].join('\n');
    const found = scoutBlocks(text);
    expect(found.path?.name).toBe('One');
    expect(found.ask?.options).toEqual(['Yes', 'No']);
  });

  it('takes the last valid block of each kind and skips broken ones', () => {
    const text = [
      '```scout-ask',
      '{"question":"First","options":["A","B"]}',
      '```',
      '```scout-ask',
      'not json',
      '```',
    ].join('\n');
    expect(scoutBlocks(text).ask?.question).toBe('First');
    expect(scoutBlocks('No blocks at all.')).toEqual({});
  });
});

describe('path names', () => {
  it('keeps the house style whoever wrote the name', () => {
    expect(cleanPathName('  Ship it!!  ')).toBe('Ship it');
    expect(cleanPathName('Backend — six weeks')).toBe('Backend, six weeks');
    expect(cleanPathName('\u{1F680} Rocket path')).toBe('Rocket path');
    expect(cleanPathName('   ')).toBe(FALLBACK_NAME);
    expect(cleanPathName('!!!')).toBe(FALLBACK_NAME);
  });

  it('cuts a long name at a word', () => {
    const long = cleanPathName(
      'Python for data work and a portfolio project before the summer starts',
    );
    expect(long.length).toBeLessThanOrEqual(MAX_NAME);
    expect(long).toBe('Python for data work and a portfolio project');
    expect(cleanPathName('x'.repeat(60))).toHaveLength(MAX_NAME);
  });
});

describe('drafts', () => {
  it('keeps known lessons once and drops empty stages', () => {
    const { draft, dropped } = draftFromBlock(
      block(
        [
          stage('One', ['basics.values', 'made.up', 'basics.values']),
          stage('Empty', ['also.made.up']),
          stage('Two', ['web.http']),
        ],
        {
          alternatives: ['Backend in six weeks', 'Server side!', 'Server side'],
          minutesPerWeek: 120,
        },
      ),
      COURSE,
    );
    expect(dropped).toBe(3);
    expect(draft.stages.map((s) => s.title)).toEqual(['One', 'Two']);
    expect(draft.stages[0]?.lessonIds).toEqual(['basics.values']);
    expect(draft.alternatives).toEqual(['Server side']);
    expect(draft.minutesPerWeek).toBe(120);
    expect(draft.deadline).toBeUndefined();
  });

  it('counts minutes from the course and leaves done lessons in', () => {
    const { draft } = draftFromBlock(
      block([stage('A', ['basics.values', 'basics.functions'])]),
      COURSE,
    );
    const facts = draftFacts(draft, COURSE, new Set(['basics.values']));
    expect(facts).toMatchObject({ lessons: 2, minutes: 25, done: 1, minutesLeft: 15 });
  });

  it('finds missing prerequisites, but not done or unknown ones', () => {
    const { draft } = draftFromBlock(block([stage('Web', ['web.rest'])]), COURSE);
    expect(draftFacts(draft, COURSE, new Set()).gaps).toEqual([
      { lessonId: 'web.http', neededBy: ['web.rest'] },
    ]);
    expect(draftFacts(draft, COURSE, new Set(['web.http'])).gaps).toEqual([]);
  });

  it('adds gaps transitively, each before the lesson that needs it', () => {
    const { draft } = draftFromBlock(block([stage('Web', ['woven.git', 'web.rest'])]), COURSE);
    const filled = addGaps(draft, COURSE, new Set(['basics.values']));
    expect(filled.stages[0]?.lessonIds).toEqual([
      'woven.git',
      'basics.functions',
      'web.http',
      'web.rest',
    ]);
    expect(draftFacts(filled, COURSE, new Set(['basics.values'])).gaps).toEqual([]);
  });

  it('puts a prerequisite before the lesson that builds on it', () => {
    const { draft } = draftFromBlock(
      block([stage('A', ['web.http']), stage('B', ['basics.values', 'basics.functions'])]),
      COURSE,
    );
    const done = new Set<string>();
    expect(draftFacts(draft, COURSE, done).orderIssues).toEqual([
      { lessonId: 'web.http', prerequisiteId: 'basics.functions' },
    ]);
    const fixed = fixOrder(draft, COURSE, done);
    expect(fixed.stages.map((s) => s.lessonIds)).toEqual([
      ['basics.values', 'basics.functions', 'web.http'],
    ]);
    expect(draftFacts(fixed, COURSE, done).orderIssues).toEqual([]);
  });

  it('edits by hand', () => {
    const draft: Draft = {
      name: 'A',
      alternatives: [],
      summary: '',
      stages: [
        { title: 'One', why: '', lessonIds: ['basics.values'] },
        { title: 'Two', why: '', lessonIds: ['web.http', 'web.rest'] },
      ],
    };
    expect(removeLesson(draft, 'basics.values').stages.map((s) => s.title)).toEqual(['Two']);
    expect(removeStage(draft, 1).stages).toHaveLength(1);
    expect(renameDraft(draft, 'New name!').name).toBe('New name');
  });
});

describe('pace', () => {
  it('counts weeks at the learner pace', () => {
    expect(pathPace(600, { minutesPerWeek: 240 }, '2026-10-06')).toEqual({ weeks: 3 });
    expect(pathPace(0, { minutesPerWeek: 240 }, '2026-10-06')).toEqual({ weeks: 1 });
  });

  it('says whether it fits the deadline', () => {
    expect(pathPace(600, { minutesPerWeek: 240, deadline: '2026-10-27' }, '2026-10-06')).toEqual({
      weeks: 3,
      daysLeft: 21,
      minutesPerWeekNeeded: 200,
      fits: true,
    });
    expect(pathPace(600, { minutesPerWeek: 120, deadline: '2026-10-13' }, '2026-10-06').fits).toBe(
      false,
    );
    expect(pathPace(60, { minutesPerWeek: 120, deadline: '2026-10-01' }, '2026-10-06').fits).toBe(
      false,
    );
  });
});

describe('the course for Scout', () => {
  const text = plannerCatalog(COURSE, [
    {
      id: 'backend',
      name: 'Backend',
      promise: 'Serve data.',
      stages: [{ title: 'HTTP', lessonIds: ['web.http'] }],
    },
    { id: 'bare', name: 'Bare', stages: [] },
  ]);

  it('lists every lesson on a line, with its prerequisites', () => {
    expect(text).toContain('## Part: Foundations (foundations)');
    expect(text).toContain('### Chapter 2: Web (web)');
    expect(text).toContain(
      '- web.rest | Title web.rest | 25 min | essential | Do web.rest. | needs web.http, ghost.lesson',
    );
    expect(text).toContain(
      '- basics.values | Title basics.values | 10 min | essential | Do basics.values.\n',
    );
  });

  it('lists chapters outside any part, and the written paths', () => {
    expect(text).toContain('## Chapters woven through the course\n### Chapter 3: Woven (woven)');
    expect(text).toContain('## Backend (backend): Serve data.\n- HTTP: web.http');
    expect(text).toContain('## Bare (bare)');
  });

  it('leaves out sections it has nothing for', () => {
    const plain = plannerCatalog({ modules: COURSE.modules.slice(0, 2), parts: COURSE.parts }, []);
    expect(plain).not.toContain('woven');
    expect(plain).not.toContain('# Written paths');
  });
});
