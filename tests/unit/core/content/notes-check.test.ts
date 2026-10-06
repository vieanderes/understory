import { describe, expect, it } from 'vitest';
import type { RawCatalog } from '@/core/content/catalog';
import {
  capstoneSolutionSchema,
  fastTrackSchema,
  lessonNotesSchema,
  type CapstoneSolution,
  type LessonNotes,
} from '@/core/content/notes';
import {
  checkCapstoneSolution,
  checkGuide,
  checkNotes,
  lectureTextProblems,
  validateFastTrack,
  validateLectures,
  validateTestsOnPaths,
} from '@/core/content/notes-check';

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const notes: LessonNotes = {
  summary: 'A cache keeps a copy close by.',
  remember: ['One.', 'Two.', 'Three.'],
  sections: [{ title: 'Underneath', body: 'It works like this.\n\n```js\nconst a = 1;\n```' }],
  pitfalls: ['**Stale data.** Set a time to live.'],
  interview: [{ question: 'Why cache?', answer: 'To save a trip.' }],
};

const solution: CapstoneSolution = {
  summary: 'Build it in three steps.',
  remember: ['Keep state on the server.', 'Validate at the edge.', 'Test the seams.'],
  sections: [
    { title: '1. Model', body: 'Tables first.' },
    { title: '2. API', body: 'Routes next.' },
    { title: '3. Tests', body: 'Then tests.' },
  ],
  checklist: ['Every route has a test.', 'Every field has a label.', 'It deploys.'],
};

const rules = (text: string) => lectureTextProblems(text).map((problem) => problem.rule);

describe('lecture text rules', () => {
  it('passes calm, plain markdown', () => {
    expect(rules('A **key** idea, with `code` and a [link](https://example.com).')).toEqual([]);
  });

  it('flags dashes, exclamation marks and banned words, but not inside code', () => {
    expect(rules(`Fast ${EM} and cheap`)).toEqual(['lecture-dash']);
    expect(rules(`Fast ${EN} and cheap`)).toEqual(['lecture-dash']);
    expect(rules(`Pages 3${EN}5`)).toEqual([]);
    expect(rules('It works!')).toEqual(['lecture-exclamation']);
    expect(rules('Use `a !== b` and `!done`.')).toEqual([]);
    expect(rules('It simply works.')).toEqual(['lecture-banned-word']);
    expect(rules('It is just a list.')).toEqual([]);
  });

  it('flags what the renderer cannot show: HTML, headings, tables, unknown fences', () => {
    expect(rules('A <div> here.')).toEqual(['lecture-raw-html']);
    expect(rules('## A heading')).toEqual(['lecture-heading']);
    expect(rules('```js\n# not a heading\n```')).toEqual([]);
    expect(rules('| a | b |\n| - | - |')).toEqual(['lecture-table']);
    expect(rules('```\nplain\n```')).toEqual(['lecture-fence-language']);
    expect(rules('```rust\nfn main() {}\n```')).toEqual(['lecture-fence-language']);
  });

  it('keeps examples generic', () => {
    // Built from parts, so this file does not trip the repository-wide ratchet it tests.
    expect(rules(`Book a ${'fest' + 'ival'} ticket.`)).toEqual(['lecture-withdrawn-setting']);
  });
});

describe('checkNotes and checkCapstoneSolution', () => {
  it('names the field of every problem', () => {
    const issues = checkNotes('n.yaml', {
      ...notes,
      remember: ['One!', 'Two.', 'Three.'],
      interview: [{ question: 'Why?', answer: `Because ${EM} yes.` }],
    });
    expect(issues.map((issue) => [issue.where, issue.rule])).toEqual([
      ['remember 1', 'lecture-exclamation'],
      ['interview 1 answer', 'lecture-dash'],
    ]);
    expect(issues[0]).toMatchObject({ severity: 'error', path: 'n.yaml' });
  });

  it('accepts notes without the optional lists', () => {
    const required: LessonNotes = {
      summary: notes.summary,
      remember: notes.remember,
      sections: notes.sections,
    };
    expect(checkNotes('n.yaml', required)).toEqual([]);
  });

  it('checks every part of a capstone solution', () => {
    expect(checkCapstoneSolution('c.yaml', solution)).toEqual([]);
    const issues = checkCapstoneSolution('c.yaml', {
      ...solution,
      checklist: ['It works!', 'Two.', 'Three.'],
    });
    expect(issues.map((issue) => issue.where)).toEqual(['checklist 1']);
  });
});

describe('validateLectures', () => {
  const catalog = (capstones: Record<string, CapstoneSolution>): RawCatalog =>
    ({
      course: {
        path: 'content/course/course.yaml',
        data: { title: 'Course', summary: 'All of it.', parts: [{ id: 'senior' }] },
        modules: [
          {
            lessons: [
              { notes: { path: 'a/notes.yaml', data: { ...notes, summary: 'Wow!' } } },
              {},
            ],
          },
        ],
        capstones: Object.fromEntries(
          Object.entries(capstones).map(([id, data]) => [id, { path: `content/capstones/${id}.yaml`, data }]),
        ),
      },
    }) as unknown as RawCatalog;

  it('checks every notes file and matches capstones to parts', () => {
    const issues = validateLectures(catalog({ senior: solution, nowhere: solution }));
    expect(issues.map((issue) => [issue.path, issue.rule])).toEqual([
      ['a/notes.yaml', 'lecture-exclamation'],
      ['content/capstones/nowhere.yaml', 'capstone-unknown-part'],
    ]);
  });

  it('has nothing to say without a course', () => {
    expect(validateLectures({})).toEqual([]);
  });
});

describe('schemas', () => {
  it('asks for at least three sentences to remember and three capstone sections', () => {
    expect(lessonNotesSchema.safeParse({ ...notes, remember: ['One.'] }).success).toBe(false);
    expect(lessonNotesSchema.safeParse(notes).success).toBe(true);
    expect(capstoneSolutionSchema.safeParse({ ...solution, sections: [] }).success).toBe(false);
    expect(lessonNotesSchema.safeParse({ ...notes, extra: 1 }).success).toBe(false);
  });
});

describe('guides and fast tracks', () => {
  it('checks every section of a guide', () => {
    const guide = { title: 'Pairs', summary: 'Side by side.', sections: [{ title: 'One', body: 'It works!' }] };
    expect(checkGuide('g.yaml', guide).map((issue) => issue.where)).toEqual(['sections 1 (One)']);
  });

  const catalog = {
    course: {
      data: { parts: [{ id: 'senior' }] },
      modules: [
        {
          lessons: [
            { data: { id: 'js.a' }, notes: { path: 'n', data: {} } },
            { data: { id: 'js.b' } },
          ],
        },
      ],
      guides: { pairs: {} },
    },
  } as unknown as RawCatalog;

  it('names unknown lessons, lessons without notes, repeats, parts and guides', () => {
    const issues = validateFastTrack(catalog, 't.yaml', {
      title: 'T',
      summary: 'S',
      outcomes: [],
      readyWhen: [],
      method: ['Read.'],
      shapes: [],
      practice: [],
      guides: ['pairs', 'missing'],
      days: [
        { title: 'Day 1', why: 'W', must: ['js.a', 'js.b', 'js.x'], should: ['js.a'], capstone: 'nowhere', tests: [] },
      ],
    });
    expect(issues.map((issue) => issue.rule)).toEqual([
      'fast-track-unknown-guide',
      'fast-track-no-notes',
      'fast-track-unknown-lesson',
      'fast-track-duplicate',
      'fast-track-unknown-part',
    ]);
  });

  const plan = (tests: unknown[][]) =>
    fastTrackSchema.parse({
      title: 'T',
      summary: 'S',
      method: ['Read.'],
      days: tests.map((list, i) => ({ title: `Day ${i + 1}`, why: 'W', must: ['js.a'], tests: list })),
    });
  const onlineTests = { presets: new Set(['demo']), tasks: new Set(['streak']) };

  it('reads a stage test as a preset, a training task or an assessment lesson', () => {
    const parsed = plan([[{ test: 'demo', guided: true }, { task: 'streak' }, { lesson: 'js.a' }]]);
    expect(parsed.days[0]?.tests).toEqual([
      { test: 'demo', guided: true },
      { task: 'streak' },
      { lesson: 'js.a' },
    ]);
    expect(plan([[]]).days[0]?.tests).toEqual([]);
    expect(() => plan([[{ key: 'demo' }]])).toThrow();
    expect(() => plan([[{ test: 'demo', task: 'streak' }]])).toThrow();
  });

  it('names unknown and repeated stage tests', () => {
    const tracked = plan([
      [{ test: 'demo' }, { test: 'nope' }, { task: 'streak' }, { task: 'gone' }],
      [{ lesson: 'js.b' }, { lesson: 'js.zzz' }, { test: 'demo' }],
    ]);
    const found = validateFastTrack(catalog, 't.yaml', tracked, onlineTests).filter(
      (issue) => issue.rule !== 'fast-track-duplicate',
    );
    expect(found.map((issue) => [issue.rule, issue.where])).toEqual([
      ['fast-track-unknown-test', 'Day 1'],
      ['fast-track-unknown-task', 'Day 1'],
      ['fast-track-unknown-lesson', 'Day 2'],
      ['fast-track-duplicate-test', 'Day 2'],
    ]);
  });

  it('treats every test as unknown when the simulator has no content', () => {
    const issues = validateFastTrack(catalog, 't.yaml', plan([[{ test: 'demo' }]]));
    expect(issues.map((issue) => issue.rule)).toEqual(['fast-track-unknown-test']);
  });

  it('warns about a test or task that no path places', () => {
    const issues = validateTestsOnPaths([plan([[{ test: 'demo' }]])], {
      presets: new Set(['demo', 'mock']),
      tasks: new Set(['streak']),
    });
    expect(issues.map((issue) => [issue.severity, issue.rule, issue.message])).toEqual([
      ['warning', 'online-test-off-path', 'No path stage lists the test "mock".'],
      ['warning', 'online-test-off-path', 'No path stage lists the training task "streak".'],
    ]);
  });

  it('warns about a lab that no path places', () => {
    const issues = validateTestsOnPaths([plan([[{ lab: 'event-loop-stepper' }]])], {
      presets: new Set(),
      tasks: new Set(),
      labs: new Set(['event-loop-stepper', 'box-model-explorer']),
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      'No path stage lists the lab "box-model-explorer".',
    ]);
  });
});
