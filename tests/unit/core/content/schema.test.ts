import { describe, expect, it } from 'vitest';
import {
  editableFields,
  FORMAT_FAMILY,
  lessonSchema,
  NEEDS_TYPING,
  stepSchema,
} from '@/core/content/schema';
import { validLessonInput } from './fixtures';

type Input = Record<string, unknown>;

const stepsOf = (lesson: Input) => lesson.steps as Input[];
const stepOfType = (lesson: Input, type: string): Input => {
  const step = stepsOf(lesson).find((s) => s.type === type);
  if (!step) throw new Error(`no ${type} step in the fixture`);
  return step;
};

describe('lessonSchema', () => {
  it('accepts the fixture lesson and fills in the defaults', () => {
    const lesson = lessonSchema.parse(validLessonInput());
    expect(lesson.prerequisites).toEqual([]);
    expect(lesson.references[0]?.verified).toBe(false);
    const challenge = lesson.steps.find((s) => s.type === 'code-challenge');
    expect(challenge).toMatchObject({
      starter: 'starter.ts',
      solution: 'solution.ts',
      tests: 'tests.ts',
    });
  });

  it('rejects a misspelt key instead of ignoring it', () => {
    const input = { ...validLessonInput(), tittle: 'Oops' };
    const result = lessonSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe('unrecognized_keys');
  });

  it('rejects an id that is not dotted lowercase', () => {
    const result = lessonSchema.safeParse({ ...validLessonInput(), id: 'Closures' });
    expect(result.error?.issues[0]?.message).toContain('dotted lowercase');
  });

  it('rejects a step id with capitals or spaces', () => {
    const input = validLessonInput();
    stepOfType(input, 'prose').id = 'My Step';
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });

  it('lets a prose step carry a known figure with a caption, and nothing else', () => {
    const input = validLessonInput();
    stepOfType(input, 'prose').figure = {
      id: 'request-hops-cold',
      caption: 'Most of the wait is round trips.',
    };
    expect(lessonSchema.safeParse(input).success).toBe(true);
    stepOfType(input, 'prose').figure = { id: 'a-drawing', caption: 'Nope.' };
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });

  it('trims text and rejects text that is only spaces', () => {
    const input = validLessonInput();
    stepOfType(input, 'prose').body = '   ';
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });

  it('needs three hints on a code challenge', () => {
    const input = validLessonInput();
    stepOfType(input, 'code-challenge').hints = ['One.', 'Two.'];
    const result = lessonSchema.safeParse(input);
    expect(result.error?.issues[0]?.message).toContain('three rungs');
  });

  it('needs three rubric points on an explain-back', () => {
    const input = validLessonInput();
    stepOfType(input, 'explain-back').rubric = ['One.'];
    expect(lessonSchema.safeParse(input).error?.issues[0]?.message).toContain('three points');
  });

  it('takes an optional audience and kind on an explain-back, from fixed lists', () => {
    const input = validLessonInput();
    const step = stepOfType(input, 'explain-back');
    expect(lessonSchema.safeParse(input).success).toBe(true);
    step.audience = 'newcomer';
    step.kind = 'risk';
    expect(lessonSchema.safeParse(input).success).toBe(true);
    for (const audience of ['teammate', 'non-technical', 'reviewer', 'interviewer', 'incident']) {
      step.audience = audience;
      expect(lessonSchema.safeParse(input).success).toBe(true);
    }
    step.kind = 'decide';
    expect(lessonSchema.safeParse(input).success).toBe(true);
    step.audience = 'manager';
    expect(lessonSchema.safeParse(input).success).toBe(false);
    step.audience = 'reviewer';
    step.kind = 'summarise';
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });

  it('takes an optional verify follow-up on a bug-hunt and an ai-review', () => {
    const verify = {
      question: 'Which test proves the fix?',
      choices: [
        { text: 'A number in a string', correct: true, feedback: 'It shows the concatenation.' },
        { text: 'An empty list', feedback: 'Nothing gets added, so nothing shows.' },
      ],
    };
    for (const type of ['bug-hunt', 'ai-review']) {
      const input = validLessonInput();
      stepOfType(input, type).verify = verify;
      expect(lessonSchema.safeParse(input).success).toBe(true);
      stepOfType(input, type).verify = { ...verify, choices: verify.choices.slice(0, 1) };
      expect(lessonSchema.safeParse(input).success).toBe(false);
      stepOfType(input, type).verify = {
        ...verify,
        choices: [...verify.choices, ...verify.choices, verify.choices[1]],
      };
      expect(lessonSchema.safeParse(input).success).toBe(false);
      stepOfType(input, type).verify = { question: 'Why?', choices: verify.choices, extra: 1 };
      expect(lessonSchema.safeParse(input).success).toBe(false);
    }
  });

  it('knows the data-exposure and regression flaw classes', () => {
    for (const flawClass of ['data-exposure', 'regression']) {
      const input = validLessonInput();
      stepOfType(input, 'ai-review').flawClass = flawClass;
      expect(lessonSchema.safeParse(input).success).toBe(true);
    }
  });

  it('keeps difficulty between 1 and 5', () => {
    const input = validLessonInput();
    stepOfType(input, 'predict-output').difficulty = 6;
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });

  it('needs three to five recall cards', () => {
    const input = validLessonInput();
    input.recall = (input.recall as unknown[]).slice(0, 2);
    expect(lessonSchema.safeParse(input).success).toBe(false);
  });

  it('needs at least one reference', () => {
    expect(lessonSchema.safeParse({ ...validLessonInput(), references: [] }).success).toBe(false);
  });
});

describe('lab and incident fallbacks', () => {
  const lab = () => structuredClone(stepOfType(validLessonInput(), 'lab'));

  it('accepts a portable step as the fallback', () => {
    expect(stepSchema.safeParse(lab()).success).toBe(true);
  });

  it('rejects a lab whose fallback is itself a lab', () => {
    const outer = lab();
    outer.fallback = { ...lab(), id: 'inner-lab' };
    expect(stepSchema.safeParse(outer).success).toBe(false);
  });

  it('rejects a lab whose fallback is an incident', () => {
    const outer = lab();
    outer.fallback = {
      type: 'incident',
      id: 'inner-incident',
      concept: 'js.coercion',
      difficulty: 3,
      incident: 'double-charge',
      fallback: lab().fallback,
    };
    expect(stepSchema.safeParse(outer).success).toBe(false);
  });

  it('rejects an incident whose fallback is a lab', () => {
    const incident = {
      type: 'incident',
      id: 'on-sale',
      concept: 'js.coercion',
      difficulty: 3,
      incident: 'double-charge',
      fallback: lab(),
    };
    expect(stepSchema.safeParse(incident).success).toBe(false);
  });

  it('rejects a lab with no fallback', () => {
    const outer = lab();
    delete outer.fallback;
    expect(stepSchema.safeParse(outer).success).toBe(false);
  });
});

describe('step families', () => {
  it('gives every scored step type a format family', () => {
    const types = stepSchema.options.map((option) => option.shape.type.value);
    for (const type of types) {
      if (type === 'prose') continue;
      expect(FORMAT_FAMILY[type]).toBeDefined();
    }
  });

  it('marks the code challenge as needing a keyboard', () => {
    expect(NEEDS_TYPING.has('code-challenge')).toBe(true);
    expect(NEEDS_TYPING.has('parsons')).toBe(false);
  });
});

describe('playground step', () => {
  // The exact shape other authors write against (docs/CONTENT-GUIDE.md, "playground").
  const contract = (): Input => ({
    type: 'playground',
    id: 'build-first-heading',
    concept: 'html.elements',
    difficulty: 1,
    prompt: 'Change the heading to your favourite food. Watch the page.',
    html: '<h1>Pancakes</h1>\n',
    css: 'h1 { color: teal; }\n',
    js: 'document.querySelector("h1").textContent = "Hello";\n',
    editable: ['html'],
    showTree: true,
    checks: [
      {
        label: 'The page has one h1',
        selector: 'h1',
        count: 1,
        text: 'Pancakes',
        attribute: { name: 'alt' },
        style: { property: 'color', value: 'rgb(0, 128, 128)' },
      },
    ],
    solution: { html: '<h1>Pancakes</h1>\n' },
    hints: ['Look at the text between the tags.'],
  });

  it('accepts the contract shape', () => {
    expect(stepSchema.safeParse(contract()).success).toBe(true);
  });

  it('accepts a free sandbox: a prompt and some HTML, nothing else', () => {
    const free = { type: 'playground', id: 'explore', prompt: 'Try any tag.', html: '' };
    expect(stepSchema.safeParse(free).success).toBe(true);
  });

  it('rejects a misspelt check key and an unknown editable field', () => {
    const typo = contract();
    typo.checks = [{ label: 'x', selector: 'h1', cont: 1 }];
    expect(stepSchema.safeParse(typo).success).toBe(false);
    const field = contract();
    field.editable = ['python'];
    expect(stepSchema.safeParse(field).success).toBe(false);
  });

  it('keeps the checklist between one and eight items', () => {
    const none = contract();
    none.checks = [];
    expect(stepSchema.safeParse(none).success).toBe(false);
    const many = contract();
    many.checks = Array.from({ length: 9 }, (_, i) => ({ label: `c${i}`, selector: 'p' }));
    expect(stepSchema.safeParse(many).success).toBe(false);
  });

  it('accepts a React playground: a component file and checks that act first', () => {
    const react = {
      type: 'playground',
      id: 'fix-counter',
      concept: 'react.state',
      difficulty: 2,
      prompt: 'Make the button count.',
      jsx: 'export default function App() { return <button>0</button>; }\n',
      checks: [
        {
          label: 'Two clicks show 2',
          actions: [{ click: 'button' }, { click: 'button' }],
          selector: 'button',
          text: '2',
        },
        { label: 'Typing fills the box', actions: [{ type: 'Milk', into: 'input' }], selector: 'li' },
      ],
      solution: { jsx: 'export default function App() { return <button>2</button>; }\n' },
    };
    expect(stepSchema.safeParse(react).success).toBe(true);
  });

  it('rejects an action that is neither a click nor typing', () => {
    const odd = contract();
    odd.checks = [{ label: 'x', selector: 'p', actions: [{ hover: 'p' }] }];
    expect(stepSchema.safeParse(odd).success).toBe(false);
    const half = contract();
    half.checks = [{ label: 'x', selector: 'p', actions: [{ type: 'Milk' }] }];
    expect(stepSchema.safeParse(half).success).toBe(false);
  });

  it('is a produce step that a phone can still take', () => {
    expect(FORMAT_FAMILY.playground).toBe('produce');
    expect(NEEDS_TYPING.has('playground')).toBe(false);
  });
});

describe('sql step', () => {
  // The exact shape other authors write against (docs/CONTENT-GUIDE.md, "SQL steps").
  const contract = (): Input => ({
    type: 'sql',
    id: 'find-unshipped-orders',
    concept: 'db.sql-queries',
    difficulty: 1,
    prompt: "Show every order that hasn't shipped yet.",
    setup:
      "create table orders (id int primary key, customer text, shipped boolean);\ninsert into orders values (1, 'Ana', true), (2, 'Ben', false);\n",
    starter: 'select * from orders;\n',
    solution: 'select * from orders where shipped = false;\n',
    checks: { ordered: false, query: 'select * from orders order by id' },
    showSchema: true,
    hints: ['A where clause keeps only some rows.'],
  });

  it('accepts the contract shape', () => {
    expect(stepSchema.safeParse(contract()).success).toBe(true);
  });

  it('accepts a free database to explore: a prompt, nothing else', () => {
    expect(stepSchema.safeParse({ type: 'sql', id: 'explore', prompt: 'Try any query.' }).success).toBe(
      true,
    );
  });

  it('accepts empty checks, and rejects a misspelt check key or an empty query', () => {
    expect(stepSchema.safeParse({ ...contract(), checks: {} }).success).toBe(true);
    expect(stepSchema.safeParse({ ...contract(), checks: { orderd: true } }).success).toBe(false);
    expect(stepSchema.safeParse({ ...contract(), checks: { query: ' ' } }).success).toBe(false);
  });

  it('is a produce step that a phone can still take', () => {
    expect(FORMAT_FAMILY.sql).toBe('produce');
    expect(NEEDS_TYPING.has('sql')).toBe(false);
  });
});

describe('editableFields', () => {
  it('defaults to every field the step has, HTML always', () => {
    expect(editableFields({})).toEqual(['html']);
    expect(editableFields({ css: '' })).toEqual(['html', 'css']);
    expect(editableFields({ css: 'a', js: 'b' })).toEqual(['html', 'css', 'js']);
  });

  it('puts a component first, with HTML only when the step has some', () => {
    expect(editableFields({ jsx: 'x' })).toEqual(['jsx']);
    expect(editableFields({ jsx: 'x', css: '' })).toEqual(['jsx', 'css']);
    expect(editableFields({ jsx: 'x', html: '<h1>Hi</h1>' })).toEqual(['jsx', 'html']);
  });

  it('keeps an explicit list as written', () => {
    expect(editableFields({ css: 'a', editable: ['css'] })).toEqual(['css']);
  });
});
