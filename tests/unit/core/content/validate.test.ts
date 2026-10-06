import { describe, expect, it } from 'vitest';
import type { Issue, RawCatalog } from '@/core/content/catalog';
import { EM_DASH, termHash, withdrawnSettingTermsIn } from '@/core/content/style';
import { RULES, validateCatalog, validateExplainBackVariety } from '@/core/content/validate';
import type {
  CodeChallengeStep,
  ExplainBackStep,
  PlaygroundStep,
  SqlStep,
} from '@/core/content/schema';
import {
  lessonOf,
  moduleOf,
  rawLesson,
  rawModule,
  stepOf,
  validCatalog,
  validLesson,
} from './fixtures';

/** Builds the valid catalog, lets the test break one thing, and returns the issues. */
function issuesAfter(mutate: (catalog: RawCatalog) => void): Issue[] {
  const catalog = validCatalog();
  mutate(catalog);
  return validateCatalog(catalog);
}

const rulesOf = (issues: Issue[]) => issues.map((issue) => issue.rule);
const only = (issues: Issue[], rule: string): Issue => {
  const found = issues.find((issue) => issue.rule === rule);
  if (!found) throw new Error(`expected an issue for ${rule}, got: ${rulesOf(issues).join(', ')}`);
  return found;
};

/** A scored playground that passes every rule, added to the fixture lesson by a test. */
function playground(over: Partial<PlaygroundStep> = {}): PlaygroundStep {
  return {
    type: 'playground',
    id: 'build-heading',
    concept: 'js.coercion',
    difficulty: 1,
    prompt: 'Change the heading.',
    html: '<h1>Pancakes</h1>',
    checks: [{ label: 'The page has one h1', selector: 'h1', count: 1 }],
    solution: { html: '<h1>Waffles</h1>' },
    ...over,
  };
}

function playgroundIssues(over: Partial<PlaygroundStep>): Issue[] {
  return issuesAfter((c) => {
    lessonOf(c).data.steps.push(playground(over));
  });
}

describe('playground rules', () => {
  const rules = (over: Partial<PlaygroundStep>) =>
    rulesOf(playgroundIssues(over)).filter((rule) => rule.startsWith('playground'));

  it('has nothing to say about a complete scored playground or a free one', () => {
    expect(rules({})).toEqual([]);
    expect(
      rules({ concept: undefined, difficulty: undefined, checks: undefined, solution: undefined }),
    ).toEqual([]);
  });

  it('needs a concept and a difficulty once there are checks', () => {
    const issue = only(playgroundIssues({ concept: undefined }), 'playground-scored-fields');
    expect(issue.where).toBe('build-heading');
    expect(issue.message).toMatch(/concept/);
    expect(only(playgroundIssues({ difficulty: undefined }), 'playground-scored-fields').message).toMatch(
      /difficulty/,
    );
  });

  it('needs a solution once there are checks, for the gate and the reveal', () => {
    expect(only(playgroundIssues({ solution: undefined }), 'playground-solution-missing').severity).toBe(
      'error',
    );
  });

  it('warns about a solution nothing can check', () => {
    expect(
      only(playgroundIssues({ checks: undefined }), 'playground-solution-unchecked').severity,
    ).toBe('warning');
  });

  it('lets the learner edit only fields the step has', () => {
    const issue = only(playgroundIssues({ editable: ['html', 'css'] }), 'playground-editable-missing');
    expect(issue.message).toMatch(/"css"/);
  });

  it('keeps the solution to fields the learner can edit', () => {
    const issue = only(
      playgroundIssues({ css: 'h1 {}', editable: ['html'], solution: { css: 'h1 { color: red; }' } }),
      'playground-solution-field',
    );
    expect(issue.message).toMatch(/"css"/);
  });

  it('rejects a check that counts zero matches and still asks about the first', () => {
    const issue = only(
      playgroundIssues({ checks: [{ label: 'No h1', selector: 'h1', count: 0, text: 'x' }] }),
      'playground-check-zero',
    );
    expect(issue.message).toMatch(/No h1/);
  });

  it('checks the prompt and check labels like any other text', () => {
    expect(rulesOf(playgroundIssues({ prompt: 'Change it!' }))).toContain('style-exclamation');
    expect(
      rulesOf(playgroundIssues({ checks: [{ label: 'Wow!', selector: 'h1' }] })),
    ).toContain('style-exclamation');
  });

  it('needs html or jsx, and keeps js out of a React playground', () => {
    expect(only(playgroundIssues({ html: undefined }), 'playground-page-missing').severity).toBe(
      'error',
    );
    const react = { html: undefined, jsx: 'export default function App() { return <h1>Hi</h1>; }' };
    expect(rules({ ...react, solution: { jsx: 'export default () => <h1>Yo</h1>;' } })).toEqual([]);
    expect(only(playgroundIssues({ ...react, js: 'alert(1)' }), 'playground-js-with-jsx').message).toMatch(
      /React/,
    );
  });

  it('runs actions only in a React playground', () => {
    const issue = only(
      playgroundIssues({ checks: [{ label: 'Click it', selector: 'h1', actions: [{ click: 'h1' }] }] }),
      'playground-actions-need-jsx',
    );
    expect(issue.severity).toBe('error');
    expect(
      rules({
        html: undefined,
        jsx: 'export default function App() { return <h1>Hi</h1>; }',
        checks: [{ label: 'Click it', selector: 'h1', actions: [{ click: 'h1' }] }],
        solution: { jsx: 'export default () => <h1>Yo</h1>;' },
      }),
    ).toEqual([]);
  });

  it('counts a scored playground as evidence for its concept, and a free one as none', () => {
    const scored = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.data.concepts.push('js.equality');
      lesson.data.steps.push(playground({ concept: 'js.equality' }));
    });
    expect(rulesOf(scored)).not.toContain('concept-unscored');
    const free = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.data.concepts.push('js.equality');
      lesson.data.steps.push(playground({ concept: 'js.equality', checks: undefined, solution: undefined }));
    });
    expect(rulesOf(free)).toContain('concept-unscored');
  });

  it('reports an unknown concept on a playground', () => {
    expect(rulesOf(playgroundIssues({ concept: 'js.nowhere' }))).toContain('concept-unknown');
  });
});

/** A scored sql step that passes every rule. */
function sql(over: Partial<SqlStep> = {}): SqlStep {
  return {
    type: 'sql',
    id: 'find-unshipped',
    concept: 'js.coercion',
    difficulty: 1,
    prompt: 'Show every order that has not shipped.',
    setup: "create table orders (id int, shipped boolean);\ninsert into orders values (1, true), (2, false);",
    starter: 'select * from orders;',
    solution: 'select * from orders where not shipped;',
    checks: { ordered: false },
    ...over,
  };
}

function sqlIssues(over: Partial<SqlStep>): Issue[] {
  return issuesAfter((c) => {
    lessonOf(c).data.steps.push(sql(over));
  });
}

describe('sql rules', () => {
  const rules = (over: Partial<SqlStep>) =>
    rulesOf(sqlIssues(over)).filter((rule) => rule.startsWith('sql'));

  it('has nothing to say about a complete scored step or a free one', () => {
    expect(rules({})).toEqual([]);
    expect(
      rules({ concept: undefined, difficulty: undefined, checks: undefined, solution: undefined }),
    ).toEqual([]);
  });

  it('needs a concept, a difficulty and a solution once there are checks', () => {
    expect(only(sqlIssues({ concept: undefined }), 'sql-scored-fields').message).toMatch(/concept/);
    expect(only(sqlIssues({ difficulty: undefined }), 'sql-scored-fields').message).toMatch(
      /difficulty/,
    );
    const missing = only(sqlIssues({ solution: undefined }), 'sql-solution-missing');
    expect(missing).toMatchObject({ severity: 'error', where: 'find-unshipped' });
  });

  it('warns about a solution nothing checks', () => {
    expect(only(sqlIssues({ checks: undefined }), 'sql-solution-unchecked').severity).toBe(
      'warning',
    );
  });

  it('warns about a schema panel with no setup to describe', () => {
    expect(only(sqlIssues({ setup: undefined, showSchema: true }), 'sql-schema-empty').severity).toBe(
      'warning',
    );
  });

  it('checks the prompt like any other text, and long SQL like any other code', () => {
    expect(rulesOf(sqlIssues({ prompt: 'Find them!' }))).toContain('style-exclamation');
    const long = Array.from({ length: 16 }, (_, i) => `select ${i};`).join('\n');
    expect(rulesOf(sqlIssues({ solution: long }))).toContain('code-too-long');
    // Seed rows are fixture data: a long setup is fine.
    expect(rulesOf(sqlIssues({ setup: long }))).not.toContain('code-too-long');
  });

  it('counts a scored step as evidence for its concept, and a free one as none', () => {
    const free = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.data.concepts.push('js.equality');
      lesson.data.steps.push(sql({ concept: 'js.equality', checks: undefined, solution: undefined }));
    });
    expect(rulesOf(free)).toContain('concept-unscored');
    const scored = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.data.concepts.push('js.equality');
      lesson.data.steps.push(sql({ concept: 'js.equality' }));
    });
    expect(rulesOf(scored)).not.toContain('concept-unscored');
  });
});

describe('validateCatalog', () => {
  it('has nothing to say about the valid fixture', () => {
    expect(validateCatalog(validCatalog())).toEqual([]);
  });

  it('reports the file, the step and the rule', () => {
    const issue = only(
      issuesAfter((c) => {
        stepOf(lessonOf(c), 'bug-hunt').lines = [9];
      }),
      'line-out-of-range',
    );
    expect(issue).toMatchObject({
      severity: 'error',
      path: 'content/course/03-javascript/01-coercion/lesson.yaml',
      where: 'hunt-total',
    });
    expect(issue.message).toContain('line 9');
    expect(issue.message).toContain('3 lines');
  });
});

describe('identity rules', () => {
  it('duplicate-lesson-id: two lessons share an id', () => {
    const issues = issuesAfter((c) => {
      const second = rawLesson();
      second.path = 'content/course/03-javascript/02-again/lesson.yaml';
      second.slug = 'again';
      second.order = 2;
      moduleOf(c).lessons.push(second);
    });
    expect(only(issues, 'duplicate-lesson-id').message).toContain('js.coercion');
  });

  it('duplicate-step-id: two steps in one lesson share an id', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'multiple-choice').id = 'predict-total';
    });
    expect(only(issues, 'duplicate-step-id').where).toBe('predict-total');
  });

  it('duplicate-step-id: a fallback counts as a step of the lesson', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'lab').fallback.id = 'intro';
    });
    expect(rulesOf(issues)).toContain('duplicate-step-id');
  });

  it('duplicate-card-id: two recall cards share an id', () => {
    const issues = issuesAfter((c) => {
      const cards = lessonOf(c).data.recall;
      if (cards[1]) cards[1].id = 'card-1';
    });
    expect(only(issues, 'duplicate-card-id').where).toBe('card-1');
  });

  it('duplicate-block-id: a distractor reuses a block id', () => {
    const issues = issuesAfter((c) => {
      const distractor = stepOf(lessonOf(c), 'parsons').distractors?.[0];
      if (distractor) distractor.id = 'read';
    });
    expect(only(issues, 'duplicate-block-id').message).toContain('read');
  });

  it('duplicate-concept-id: a concept is defined twice', () => {
    const issues = issuesAfter((c) => {
      const concepts = moduleOf(c).data.concepts;
      if (concepts[1]) concepts[1].id = 'js.coercion';
    });
    expect(rulesOf(issues)).toContain('duplicate-concept-id');
  });

  it('duplicate-module-id: two modules share an id', () => {
    const issues = issuesAfter((c) => {
      const copy = rawModule([]);
      copy.path = 'content/course/04-again/module.yaml';
      copy.order = 4;
      copy.data.number = 4;
      copy.data.concepts = [{ id: 'js.other', title: 'Other', summary: 'Another concept.' }];
      c.course?.modules.push(copy);
    });
    expect(rulesOf(issues)).toContain('duplicate-module-id');
  });

  it('a catalog without a course has no modules, so the id rules find nothing', () => {
    const issues = issuesAfter((c) => {
      delete c.course;
    });
    expect(rulesOf(issues).filter((rule) => rule.startsWith('duplicate-'))).toEqual([]);
  });
});

describe('layout rules', () => {
  it('duplicate-order: two modules share a number prefix', () => {
    const issues = issuesAfter((c) => {
      const copy = rawModule([]);
      copy.path = 'content/course/03-again/module.yaml';
      copy.slug = 'again';
      copy.data.id = 'again';
      copy.data.concepts = [{ id: 'again.other', title: 'Other', summary: 'Another concept.' }];
      c.course?.modules.push(copy);
    });
    expect(only(issues, 'duplicate-order').message).toContain('03');
  });

  it('module-number: the folder prefix differs from `number`', () => {
    const issues = issuesAfter((c) => {
      moduleOf(c).order = 4;
    });
    expect(only(issues, 'module-number').message).toContain('04-');
  });

  it('duplicate-order: two lessons share a number prefix', () => {
    const issues = issuesAfter((c) => {
      const data = validLesson();
      data.id = 'js.other';
      const second = rawLesson(data);
      second.path = 'content/course/03-javascript/01-other/lesson.yaml';
      second.slug = 'other';
      moduleOf(c).lessons.push(second);
    });
    expect(rulesOf(issues)).toContain('duplicate-order');
  });

  it('lesson-id-prefix: a lesson id does not start with its module id', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.id = 'css.coercion';
    });
    expect(only(issues, 'lesson-id-prefix').message).toContain('js.');
  });

  it('concept-id-prefix: a concept id does not start with its module id', () => {
    const issues = issuesAfter((c) => {
      const concepts = moduleOf(c).data.concepts;
      if (concepts[1]) concepts[1].id = 'css.equality';
    });
    expect(rulesOf(issues)).toContain('concept-id-prefix');
  });
});

describe('reference rules', () => {
  it('concept-unknown: a step names a concept no module defines', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'predict-output').concept = 'js.nowhere';
    });
    const issue = only(issues, 'concept-unknown');
    expect(issue.where).toBe('predict-total');
    expect(issue.message).toContain('js.nowhere');
  });

  it('concept-unknown: a recall card names a concept no module defines', () => {
    const issues = issuesAfter((c) => {
      const card = lessonOf(c).data.recall[0];
      if (card) card.concept = 'js.nowhere';
    });
    expect(only(issues, 'concept-unknown').where).toBe('card-1');
  });

  it('concept-unknown: a fallback names a concept no module defines', () => {
    const issues = issuesAfter((c) => {
      const fallback = stepOf(lessonOf(c), 'lab').fallback;
      if (fallback.type !== 'prose') fallback.concept = 'js.nowhere';
    });
    expect(rulesOf(issues)).toContain('concept-unknown');
  });

  it('concept-unknown: the lesson lists a concept no module defines', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.concepts.push('js.nowhere');
    });
    expect(rulesOf(issues)).toContain('concept-unknown');
  });

  it('concept-foreign-module: the lesson lists a concept of another module', () => {
    const issues = issuesAfter((c) => {
      const other = rawModule([]);
      other.path = 'content/course/02-css/module.yaml';
      other.slug = 'css';
      other.order = 2;
      other.data.id = 'css';
      other.data.number = 2;
      other.data.concepts = [{ id: 'css.cascade', title: 'Cascade', summary: 'Which rule wins.' }];
      c.course?.modules.push(other);
      lessonOf(c).data.concepts.push('css.cascade');
    });
    expect(only(issues, 'concept-foreign-module').message).toContain('css.cascade');
  });

  it('confusable-unknown: confusableWith points at nothing', () => {
    const issues = issuesAfter((c) => {
      const concept = moduleOf(c).data.concepts[0];
      if (concept) concept.confusableWith = ['js.nowhere'];
    });
    expect(only(issues, 'confusable-unknown').path).toContain('module.yaml');
  });

  it('prerequisite-unknown: a prerequisite is not a lesson', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.prerequisites = ['js.nowhere'];
    });
    expect(only(issues, 'prerequisite-unknown').message).toContain('js.nowhere');
  });

  it('prerequisite-unknown: a lesson cannot require itself', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.prerequisites = ['js.coercion'];
    });
    expect(only(issues, 'prerequisite-unknown').message).toContain('itself');
  });
});

describe('choice rules', () => {
  it.each(['predict-output', 'multiple-choice'] as const)(
    'one-correct: %s with no correct choice',
    (type) => {
      const issues = issuesAfter((c) => {
        for (const choice of stepOf(lessonOf(c), type).choices) delete choice.correct;
      });
      expect(only(issues, 'one-correct').message).toContain('none');
    },
  );

  it.each(['bug-hunt', 'ai-review'] as const)('one-correct: %s with two correct reasons', (type) => {
    const issues = issuesAfter((c) => {
      for (const reason of stepOf(lessonOf(c), type).reasons) reason.correct = true;
    });
    expect(only(issues, 'one-correct').message).toContain('2');
  });

  it.each(['bug-hunt', 'ai-review'] as const)('one-correct: a verify follow-up on a %s', (type) => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), type).verify = {
        question: 'Which test proves the fix?',
        choices: [
          { text: 'A string quantity', feedback: 'It shows the join.' },
          { text: 'An empty cart', feedback: 'Nothing is added.' },
        ],
      };
    });
    const issue = only(issues, 'one-correct');
    expect(issue.message).toContain('verify.choices');
    expect(issue.message).toContain('none');
  });

  it('runs the style rules over a verify follow-up', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'bug-hunt').verify = {
        question: 'Which test proves the fix!',
        choices: [
          { text: 'A string quantity', correct: true, feedback: 'It shows the join.' },
          { text: 'An empty cart', feedback: 'Nothing is added.' },
        ],
      };
    });
    expect(only(issues, 'style-exclamation').where).toBe('hunt-total');
  });

  it('one-correct: a lab checkpoint', () => {
    const issues = issuesAfter((c) => {
      for (const choice of stepOf(lessonOf(c), 'lab').checkpoint?.choices ?? []) {
        choice.correct = true;
      }
    });
    expect(only(issues, 'one-correct').where).toBe('lab-coercion');
  });

  it('one-correct: a fallback step is checked like any other', () => {
    const issues = issuesAfter((c) => {
      const fallback = stepOf(lessonOf(c), 'lab').fallback;
      if (fallback.type === 'multiple-choice') {
        for (const choice of fallback.choices) delete choice.correct;
      }
    });
    expect(only(issues, 'one-correct').where).toBe('lab-coercion-fallback');
  });
});

describe('incident steps', () => {
  const withIncident = (c: RawCatalog, lines: number[]) => {
    const hunt = structuredClone(stepOf(lessonOf(c), 'bug-hunt'));
    lessonOf(c).data.steps.push({
      type: 'incident',
      id: 'double-charge',
      concept: 'js.coercion',
      difficulty: 4,
      incident: 'double-charge',
      fallback: { ...hunt, id: 'double-charge-fallback', lines },
    });
    // The new ids are not what this test is about.
    delete c.lock;
  };

  it('accepts an incident with a sound fallback', () => {
    expect(rulesOf(issuesAfter((c) => withIncident(c, [2])))).toEqual(['lock-stale']);
  });

  it('checks the fallback of an incident like any other step', () => {
    const issues = issuesAfter((c) => withIncident(c, [9]));
    expect(only(issues, 'line-out-of-range').where).toBe('double-charge-fallback');
  });
});

describe('code position rules', () => {
  it('line-out-of-range: ai-review points past the end of the code', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'ai-review').lines = [1, 4];
    });
    expect(only(issues, 'line-out-of-range').where).toBe('review-total');
  });

  it('line-out-of-range: a trace row points past the end of the code', () => {
    const issues = issuesAfter((c) => {
      const row = stepOf(lessonOf(c), 'trace-table').rows[1];
      if (row) row.line = 7;
    });
    expect(only(issues, 'line-out-of-range').where).toBe('trace-total');
  });

  it('trace-row-width: a row has the wrong number of values', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'trace-table').rows[1]?.values.pop();
    });
    expect(only(issues, 'trace-row-width').message).toContain('2 columns');
  });

  it('trace-all-given: every row is given, so nothing is asked', () => {
    const issues = issuesAfter((c) => {
      for (const row of stepOf(lessonOf(c), 'trace-table').rows) row.given = true;
    });
    expect(rulesOf(issues)).toContain('trace-all-given');
  });
});

describe('fill-blank rules', () => {
  it('blank-missing: the template has a blank with no answer', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'fill-blank').template += ' // {{3}}';
    });
    expect(only(issues, 'blank-missing').message).toContain('{{3}}');
  });

  it('blank-unused: an answer has no blank in the template', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'fill-blank').blanks.push({ key: '3', answer: '1' });
    });
    expect(only(issues, 'blank-unused').message).toContain('{{3}}');
  });

  it('blank-duplicate: two blanks share a key', () => {
    const issues = issuesAfter((c) => {
      const blank = stepOf(lessonOf(c), 'fill-blank').blanks[1];
      if (blank) blank.key = '1';
    });
    expect(rulesOf(issues)).toContain('blank-duplicate');
  });

  it('blank-answer-not-in-bank: the right token cannot be picked', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'fill-blank').bank = ['String', '1'];
    });
    expect(only(issues, 'blank-answer-not-in-bank').message).toContain('Number');
  });
});

describe('withdrawn-setting', () => {
  it('finds a hashed term as words, joined, hyphenated or in camel case', () => {
    const hashes = new Set([termHash('harbourlights')]);
    expect(withdrawnSettingTermsIn('Meet at Harbour Lights.', hashes)).toEqual(['Harbour Lights']);
    expect(withdrawnSettingTermsIn('harbour-lights.example', hashes)).toEqual(['harbour lights']);
    expect(withdrawnSettingTermsIn('const harbourLightsApi = 1;', hashes)).toEqual(['harbour Lights']);
    expect(withdrawnSettingTermsIn('The harbour has lights.', hashes)).toEqual([]);
  });

  it.each(['the festival site', 'festivals', 'festivalSite', 'a ticket shop', 'ticket-shop.example', 'ticketShop'])(
    'is an error wherever a step says "%s"',
    (term) => {
      const issue = only(
        issuesAfter((c) => {
          stepOf(lessonOf(c), 'bug-hunt').prompt = `Open ${term} and look.`;
        }),
        'withdrawn-setting',
      );
      expect(issue).toMatchObject({ severity: 'error', where: 'hunt-total' });
    },
  );

  it('searches recall cards, the deep dive and the challenge files too', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.data.recall[0]!.back = 'At the festival.';
      lesson.data.deepDive = 'The ticket shop.';
      lesson.files = { ...lesson.files, 'starter.ts': "const shop = 'festivalShop';" };
    });
    const where = issues.filter((i) => i.rule === 'withdrawn-setting').map((i) => i.where);
    expect(where.sort()).toEqual(['deepDive', 'recall', 'starter.ts']);
  });

  it('leaves ordinary words that contain a term alone', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'bug-hunt').prompt = 'Festivalgoers and ticketshopping are other words.';
    });
    expect(rulesOf(issues)).not.toContain('withdrawn-setting');
  });
});

describe('lesson shape rules', () => {
  it('no-explain-back: the lesson never asks for an explanation', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c).data;
      lesson.steps = lesson.steps.filter((step) => step.type !== 'explain-back');
    });
    expect(only(issues, 'no-explain-back').severity).toBe('error');
  });

  it('concept-unscored: a listed concept has no scored step (warning)', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.concepts.push('js.equality');
    });
    const issue = only(issues, 'concept-unscored');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('js.equality');
  });

  it('step-variety: fewer than three step types', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c).data;
      lesson.steps = lesson.steps.filter(
        (step) => step.type === 'prose' || step.type === 'explain-back',
      );
    });
    expect(only(issues, 'step-variety').message).toContain('2');
  });

  it('lesson-minutes: an ordinary lesson longer than an hour', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.minutes = 90;
    });
    expect(only(issues, 'lesson-minutes').where).toBe('minutes');
  });

  it('assessment-shape: hidden tests outside an assessment', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      stepOf(lesson, 'code-challenge').hidden = 'hidden.ts';
      lesson.files = { ...lesson.files, 'hidden.ts': "test('a', () => {});" };
    });
    expect(only(issues, 'assessment-shape').message).toContain('assessment: true');
  });

  it('assessment-shape: an assessment with other steps and no hidden tests', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c).data;
      lesson.assessment = true;
      lesson.minutes = 90;
    });
    const messages = issues.filter((i) => i.rule === 'assessment-shape').map((i) => i.message);
    expect(messages.some((m) => m.includes('prose briefs and code challenges only'))).toBe(true);
    expect(messages.some((m) => m.includes('needs "hidden" tests'))).toBe(true);
    // An assessment is exempt from the lesson-only rules.
    expect(rulesOf(issues)).not.toContain('lesson-minutes');
    expect(rulesOf(issues)).not.toContain('no-explain-back');
  });

  it('assessment-shape: a valid assessment has nothing to say', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.data.assessment = true;
      lesson.data.minutes = 90;
      lesson.data.steps = lesson.data.steps.filter(
        (step) => step.type === 'prose' || step.type === 'code-challenge',
      );
      stepOf(lesson, 'code-challenge').hidden = 'hidden.ts';
      lesson.files = { ...lesson.files, 'hidden.ts': "test('a', () => {});" };
    });
    // Dropping steps retires their ids from the fixture's lock; that is the lock's concern.
    const ignored = new Set(['lock-id-removed']);
    expect(rulesOf(issues).filter((r) => !ignored.has(r))).toEqual([]);
  });

  it('assessment-shape: more than three tasks', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c).data;
      lesson.assessment = true;
      const task = lesson.steps.find((step) => step.type === 'code-challenge');
      if (!task) throw new Error('fixture has a challenge');
      lesson.steps = [0, 1, 2, 3].map((n) => ({
        ...task,
        id: `task-${n}`,
        starter: `s${n}.ts`,
        solution: `x${n}.ts`,
        tests: `t${n}.ts`,
        hidden: `h${n}.ts`,
      }));
    });
    expect(only(issues, 'assessment-shape').message).toContain('This one has 4');
  });

  it('performance-without-hidden: performance tests with no hidden tests', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      stepOf(lesson, 'code-challenge').performance = 'performance.ts';
      lesson.files = { ...lesson.files, 'performance.ts': "test('a', () => {});" };
    });
    expect(rulesOf(issues)).toContain('performance-without-hidden');
  });

  it('opening-too-long: the opening has three sentences', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.opening.text = 'The cart is wrong. It shows 21. Nobody knows why.';
    });
    expect(only(issues, 'opening-too-long').where).toBe('opening');
  });

  it('opening-too-long: a full stop inside code is not a sentence end', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.opening.text = 'The cart calls `items.length` twice. It shows 21.';
    });
    expect(rulesOf(issues)).not.toContain('opening-too-long');
  });
});

describe('code challenge file rules', () => {
  it('challenge-file-missing: a sibling file does not exist', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      lesson.files = { 'starter.ts': 'x', 'tests.ts': 'y' };
    });
    const issue = only(issues, 'challenge-file-missing');
    expect(issue.where).toBe('write-total');
    expect(issue.message).toContain('solution.ts');
  });

  it('challenge-file-name: a file name tries to leave the lesson folder', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'code-challenge').tests = '../tests.ts';
    });
    expect(rulesOf(issues)).toContain('challenge-file-name');
    // An unsafe name is never looked up, so it is not also reported as missing.
    expect(rulesOf(issues)).not.toContain('challenge-file-missing');
  });

  it('challenge-file-language: a tsx challenge names .tsx files, and only a tsx challenge does', () => {
    const tsx = issuesAfter((c) => {
      const lesson = lessonOf(c);
      const step = stepOf(lesson, 'code-challenge');
      step.language = 'tsx';
      step.starter = 'starter.tsx';
      step.solution = 'solution.tsx';
      step.tests = 'tests.ts';
      lesson.files = { 'starter.tsx': 'a', 'solution.tsx': 'b', 'tests.ts': 'c' };
    });
    const issue = only(tsx, 'challenge-file-language');
    expect(issue.message).toContain('"tests.ts"');
    expect(issue.message).toContain('.tsx');

    const plain = issuesAfter((c) => {
      const lesson = lessonOf(c);
      stepOf(lesson, 'code-challenge').starter = 'starter.tsx';
      lesson.files = { ...lesson.files, 'starter.tsx': 'a' };
    });
    expect(only(plain, 'challenge-file-language').message).toContain(
      '"starter.tsx" is a .tsx file',
    );
  });

  it('accepts a tsx challenge with .tsx files', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      const step = stepOf(lesson, 'code-challenge');
      step.language = 'tsx';
      step.starter = 'starter.tsx';
      step.solution = 'solution.tsx';
      step.tests = 'tests.tsx';
      lesson.files = { 'starter.tsx': 'a', 'solution.tsx': 'b', 'tests.tsx': 'c' };
    });
    expect(rulesOf(issues)).not.toContain('challenge-file-name');
    expect(rulesOf(issues)).not.toContain('challenge-file-language');
    expect(rulesOf(issues)).not.toContain('challenge-file-missing');
  });

  it('challenge-file-language: a Python challenge left on the .ts defaults', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'code-challenge').language = 'python';
    });
    const found = issues.filter((issue) => issue.rule === 'challenge-file-language');
    expect(found.map((issue) => issue.message)).toContainEqual(
      expect.stringContaining('"starter.ts" is not a Python file'),
    );
    expect(found[0]?.message).toContain('starter: starter.py');
  });

  it('challenge-file-language: a TypeScript challenge pointing at a .py file', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'code-challenge').tests = 'tests.py';
    });
    expect(only(issues, 'challenge-file-language').message).toContain('"tests.py"');
  });

  it('accepts a Python challenge with its .py files next to lesson.yaml', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      const step = stepOf(lesson, 'code-challenge');
      step.language = 'python';
      step.starter = 'starter.py';
      step.solution = 'solution.py';
      step.tests = 'tests.py';
      lesson.files = { 'starter.py': 'x', 'solution.py': 'y', 'tests.py': 'z' };
    });
    const rules = rulesOf(issues);
    expect(rules).not.toContain('challenge-file-language');
    expect(rules).not.toContain('challenge-file-name');
    expect(rules).not.toContain('challenge-file-missing');
  });

  it('challenge-file-shared: two challenges use the same file', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c).data;
      const second = structuredClone(stepOf(lessonOf(c), 'code-challenge'));
      second.id = 'write-again';
      lesson.steps.push(second);
    });
    expect(rulesOf(issues)).toContain('challenge-file-shared');
  });
});

describe('twin rules', () => {
  const TWIN_FILES = { 'starter.py': 'x', 'solution.py': 'y', 'tests.py': 'z' };
  function withTwin(
    over: Partial<NonNullable<CodeChallengeStep['twin']>> = {},
    files: Record<string, string> = TWIN_FILES,
  ) {
    return issuesAfter((c) => {
      const lesson = lessonOf(c);
      stepOf(lesson, 'code-challenge').twin = {
        language: 'python',
        starter: 'starter.py',
        solution: 'solution.py',
        tests: 'tests.py',
        ...over,
      };
      lesson.files = { ...lesson.files, ...files };
    });
  }

  it('accepts a Python twin of a TypeScript challenge', () => {
    const rules = rulesOf(withTwin());
    for (const rule of ['challenge-file-language', 'challenge-file-missing', 'twin-shape']) {
      expect(rules).not.toContain(rule);
    }
  });

  it('challenge-file-missing: a twin file does not exist', () => {
    const issue = only(withTwin({}, { 'starter.py': 'x', 'tests.py': 'z' }), 'challenge-file-missing');
    expect(issue.message).toContain('"solution.py"');
  });

  it('challenge-file-language: twin files follow the twin language', () => {
    const issue = only(withTwin({ tests: 'tests.ts' }), 'challenge-file-language');
    expect(issue.message).toContain('"tests.ts"');
  });

  it('challenge-file-shared: a twin that points at the main files', () => {
    const issues = withTwin({ language: 'js', starter: 'starter.ts', solution: 'solution.ts', tests: 'tests.ts' });
    expect(rulesOf(issues)).toContain('challenge-file-shared');
  });

  it('twin-shape: a twin in the main language', () => {
    const issue = only(
      withTwin(
        { language: 'ts', starter: 'twin.starter.ts', solution: 'twin.solution.ts', tests: 'twin.tests.ts' },
        { 'twin.starter.ts': 'a', 'twin.solution.ts': 'b', 'twin.tests.ts': 'c' },
      ),
      'twin-shape',
    );
    expect(issue.where).toBe('write-total');
    expect(issue.message).toContain('another language');
  });

  it('twin-shape: a twin on an assessment task', () => {
    const issues = issuesAfter((c) => {
      const lesson = lessonOf(c);
      const step = stepOf(lesson, 'code-challenge');
      step.hidden = 'hidden.ts';
      step.twin = { language: 'python', starter: 'starter.py', solution: 'solution.py', tests: 'tests.py' };
      lesson.files = { ...lesson.files, ...TWIN_FILES, 'hidden.ts': 'h' };
    });
    expect(only(issues, 'twin-shape').message).toContain('assessment');
  });

  it('python-packages: reads the twin files against the twin packages', () => {
    const issue = only(
      withTwin({}, { ...TWIN_FILES, 'solution.py': 'import numpy as np\n' }),
      'python-packages',
    );
    expect(issue.message).toContain('packages: [numpy]');
    expect(rulesOf(withTwin({ packages: ['numpy'] }, { ...TWIN_FILES, 'solution.py': 'import numpy\n' }))).not.toContain('python-packages');
  });

  it('editable-range: checks the twin range against the twin starter', () => {
    const issue = only(withTwin({ editable: '9' }), 'editable-range');
    expect(issue.message).toContain('line 9');
  });
});

describe('Python package rules', () => {
  function pythonStep(files: Record<string, string>, packages?: ('numpy' | 'pandas' | 'pydantic')[]) {
    return issuesAfter((c) => {
      const lesson = lessonOf(c);
      const step = stepOf(lesson, 'code-challenge');
      step.language = 'python';
      step.starter = 'starter.py';
      step.solution = 'solution.py';
      step.tests = 'tests.py';
      if (packages) step.packages = packages;
      lesson.files = { 'starter.py': '', 'solution.py': '', 'tests.py': '', ...files };
    });
  }

  it('accepts a step that names exactly the packages its files import', () => {
    const issues = pythonStep(
      { 'solution.py': 'import numpy as np\n', 'tests.py': 'from pandas import DataFrame\n' },
      ['numpy', 'pandas'],
    );
    expect(rulesOf(issues)).not.toContain('python-packages');
  });

  it('python-packages: an import the step does not name', () => {
    const issue = only(
      pythonStep({ 'solution.py': 'from pydantic import BaseModel\n' }),
      'python-packages',
    );
    expect(issue.where).toBe('write-total');
    expect(issue.message).toContain('packages: [pydantic]');
  });

  it('python-packages: a named package nothing imports', () => {
    const issue = only(pythonStep({}, ['numpy']), 'python-packages');
    expect(issue.message).toContain('"numpy"');
  });

  it('python-packages: packages on a step that is not Python', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'code-challenge').packages = ['numpy'];
    });
    expect(only(issues, 'python-packages').message).toContain('Python');
  });
});

describe('editable region rules', () => {
  const withEditable = (editable: string, solution?: string) =>
    issuesAfter((c) => {
      const lesson = lessonOf(c);
      stepOf(lesson, 'code-challenge').editable = editable;
      if (solution !== undefined) lesson.files = { ...lesson.files, 'solution.ts': solution };
    });

  it('accepts a range of starter lines that the solution only changes inside', () => {
    const issues = withEditable('2');
    expect(rulesOf(issues)).not.toContain('editable-range');
    expect(rulesOf(issues)).not.toContain('editable-solution');
  });

  it('editable-range: not a range of line numbers', () => {
    const issue = only(withEditable('two'), 'editable-range');
    expect(issue.where).toBe('write-total');
    expect(issue.message).toContain('"2-4"');
  });

  it('editable-range: past the last line of the starter', () => {
    expect(only(withEditable('3-9'), 'editable-range').message).toContain('3 lines');
  });

  it('editable-range: the whole starter, which locks nothing', () => {
    expect(only(withEditable('1-3'), 'editable-range').message).toContain('locks nothing');
  });

  it('editable-solution: the solution changes a locked line', () => {
    const issue = only(
      withEditable('2', 'export function cartTotal(): number {\n  return 3;\n}\nexport {};\n'),
      'editable-solution',
    );
    expect(issue.message).toContain('locked');
  });
});

describe('type-check rules', () => {
  const challengeIssues = (edit: (step: CodeChallengeStep) => void) =>
    issuesAfter((c) => edit(stepOf(lessonOf(c), 'code-challenge')));

  it('accepts typecheck and an expected starter error on a TypeScript challenge', () => {
    const rules = rulesOf(
      challengeIssues((step) => {
        step.typecheck = true;
        step.expectStarterTypeError = true;
      }),
    );
    expect(rules).not.toContain('typecheck-language');
    expect(rules).not.toContain('typecheck-expectation');
  });

  it('typecheck-language: only TypeScript files are type-checked', () => {
    const issues = challengeIssues((step) => {
      step.language = 'js';
      step.typecheck = true;
    });
    expect(only(issues, 'typecheck-language').message).toContain('TypeScript');
  });

  it('typecheck-language: allows typecheck: false anywhere, since it asks for nothing', () => {
    const issues = challengeIssues((step) => {
      step.language = 'js';
      step.typecheck = false;
    });
    expect(rulesOf(issues)).not.toContain('typecheck-language');
  });

  it('typecheck-expectation: an expected type error needs the checker on', () => {
    const issues = challengeIssues((step) => {
      step.typecheck = false;
      step.expectStarterTypeError = true;
    });
    expect(only(issues, 'typecheck-expectation').severity).toBe('error');
  });
});

describe('markdown rules', () => {
  it('markdown-html: raw HTML in a prose body', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'prose').body = 'The field holds <b>text</b>.';
    });
    const issue = only(issues, 'markdown-html');
    expect(issue.severity).toBe('error');
    expect(issue.where).toBe('intro');
    expect(issue.message).toContain('body');
  });

  it('markdown-html: raw HTML in choice feedback, found by the same walker', () => {
    const issues = issuesAfter((c) => {
      const choice = stepOf(lessonOf(c), 'predict-output').choices[1];
      if (choice) choice.feedback = 'No.<br>Think again.';
    });
    expect(only(issues, 'markdown-html').message).toContain('choices[1].feedback');
  });

  it('markdown-html: a tag inside code is fine', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'prose').body = 'The `<input>` element holds text.\n\n```html\n<b>x</b>\n```';
    });
    expect(rulesOf(issues)).not.toContain('markdown-html');
  });

  it('markdown-h1: a level-1 heading in the deep dive', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.deepDive = '# The abstract operation\n\nIt is called ToPrimitive.';
    });
    expect(only(issues, 'markdown-h1').where).toBe('deepDive');
  });

  it('markdown-h1: a # comment inside a fence is fine', () => {
    const issues = issuesAfter((c) => {
      lessonOf(c).data.deepDive = 'Run this.\n\n```bash\n# list files\nls\n```';
    });
    expect(rulesOf(issues)).not.toContain('markdown-h1');
  });

  it('markdown-inline-block: choice text must be one line of inline markdown', () => {
    const issues = issuesAfter((c) => {
      const choice = stepOf(lessonOf(c), 'multiple-choice').choices[0];
      if (choice) choice.text = 'First paragraph.\n\nSecond paragraph.';
    });
    expect(rulesOf(issues)).toContain('markdown-inline-block');
  });
});

describe('style ratchets (warnings)', () => {
  const proseWith = (body: string) =>
    issuesAfter((c) => {
      stepOf(lessonOf(c), 'prose').body = body;
    });

  it.each([
    'basically',
    'simply',
    'just',
    'powerful',
    'robust',
    'easy',
    'obviously',
    'Please',
    'successfully',
  ])('style-banned-word: %s', (word) => {
    const issue = only(proseWith(`The total is ${word} a string.`), 'style-banned-word');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain(word);
  });

  it('style-banned-word: a word that only contains a banned word is fine', () => {
    expect(rulesOf(proseWith('Adjust the total to justify the fee.'))).toEqual([]);
  });

  it('style-banned-word: a banned word inside code is fine', () => {
    expect(rulesOf(proseWith('The flag `easy` is a string.'))).toEqual([]);
  });

  it('style-banned-word: prompts are checked too', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'explain-back').prompt = 'Why is this simply wrong?';
    });
    expect(only(issues, 'style-banned-word').where).toBe('explain-total');
  });

  it('style-exclamation: an exclamation mark in prose', () => {
    expect(only(proseWith('The total is a string!'), 'style-exclamation').severity).toBe('warning');
  });

  it('style-exclamation: the `!` operator inside code is fine', () => {
    expect(rulesOf(proseWith('The check `a !== b` compares types too.'))).toEqual([]);
  });

  it('style-em-dash: the em-dash character', () => {
    expect(rulesOf(proseWith(`The total ${EM_DASH} a string ${EM_DASH} is wrong.`))).toContain('style-em-dash');
  });

  it('style-long-sentence: more than 28 words', () => {
    const long = `${Array.from({ length: 29 }, () => 'word').join(' ')}.`;
    expect(only(proseWith(long), 'style-long-sentence').message).toContain('29');
  });

  it('style-long-sentence: 28 words is the limit, not over it', () => {
    const limit = `${Array.from({ length: 28 }, () => 'word').join(' ')}. Short one.`;
    expect(rulesOf(proseWith(limit))).toEqual([]);
  });

  it('style-long-sentence: list items are separate sentences', () => {
    const item = Array.from({ length: 10 }, () => 'word').join(' ');
    expect(rulesOf(proseWith(`- ${item}\n- ${item}\n- ${item}`))).toEqual([]);
  });

  it('code-too-long: step code over 15 lines', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'predict-output').code = Array.from(
        { length: 16 },
        (_, i) => `console.log(${i});`,
      ).join('\n');
    });
    const issue = only(issues, 'code-too-long');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('16');
  });

  it('code-too-long: a fenced block over 15 lines in markdown', () => {
    const fence = ['```js', ...Array.from({ length: 16 }, (_, i) => `log(${i});`), '```'].join('\n');
    expect(rulesOf(proseWith(`Read this.\n\n${fence}`))).toContain('code-too-long');
  });
});

describe('ids lock rules', () => {
  it('lock-id-removed: a published step id has gone', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'prose').id = 'renamed-intro';
    });
    const issue = only(issues, 'lock-id-removed');
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('content/ids.lock.json');
    expect(issue.message).toContain('step:js.coercion/intro');
    expect(issue.message).toContain('retired');
  });

  it('lock-id-removed: retiring the id is the way out', () => {
    const issues = issuesAfter((c) => {
      stepOf(lessonOf(c), 'prose').id = 'renamed-intro';
      c.lock?.retired.push('step:js.coercion/intro');
      c.lock?.published.push('step:js.coercion/renamed-intro');
    });
    expect(issues).toEqual([]);
  });

  it('lock-id-reused: a retired id is back in the content', () => {
    const issues = issuesAfter((c) => {
      c.lock?.retired.push('step:js.coercion/intro');
    });
    expect(only(issues, 'lock-id-reused').message).toContain('step:js.coercion/intro');
  });

  it('lock-stale: new ids are not in the lock yet (warning)', () => {
    const issues = issuesAfter((c) => {
      c.lock = { schema: 1, published: [], retired: [] };
    });
    const issue = only(issues, 'lock-stale');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('--write-lock');
  });

  it('lock-stale: no lock file at all', () => {
    const issues = issuesAfter((c) => {
      delete c.lock;
    });
    expect(rulesOf(issues)).toEqual(['lock-stale']);
  });
});

describe('RULES', () => {
  it('lists every rule once per severity, so the docs and this file stay complete', () => {
    // Adding a rule means adding it here, and a test for it above.
    expect([...new Set(RULES.map((entry) => entry.rule))].sort()).toEqual([
      'assessment-shape',
      'blank-answer-not-in-bank',
      'blank-duplicate',
      'blank-missing',
      'blank-unused',
      'challenge-file-language',
      'challenge-file-missing',
      'challenge-file-name',
      'challenge-file-shared',
      'code-too-long',
      'concept-foreign-module',
      'concept-id-prefix',
      'concept-unknown',
      'concept-unscored',
      'confusable-unknown',
      'duplicate-block-id',
      'duplicate-card-id',
      'duplicate-concept-id',
      'duplicate-lesson-id',
      'duplicate-module-id',
      'duplicate-order',
      'duplicate-step-id',
      'editable-range',
      'editable-solution',
      'lesson-id-prefix',
      'lesson-minutes',
      'line-out-of-range',
      'lock-id-removed',
      'lock-id-reused',
      'lock-stale',
      'markdown-h1',
      'markdown-html',
      'markdown-inline-block',
      'module-number',
      'no-explain-back',
      'one-correct',
      'opening-too-long',
      'performance-without-hidden',
      'playground-actions-need-jsx',
      'playground-check-zero',
      'playground-editable-missing',
      'playground-js-with-jsx',
      'playground-page-missing',
      'playground-scored-fields',
      'playground-solution-field',
      'playground-solution-missing',
      'playground-solution-unchecked',
      'prerequisite-unknown',
      'python-packages',
      'sql-schema-empty',
      'sql-scored-fields',
      'sql-solution-missing',
      'sql-solution-unchecked',
      'step-variety',
      'style-banned-word',
      'style-em-dash',
      'style-exclamation',
      'style-long-sentence',
      'trace-all-given',
      'trace-row-width',
      'twin-shape',
      'typecheck-expectation',
      'typecheck-language',
      'withdrawn-setting',
    ]);
  });

  it('keeps the style ratchets as warnings', () => {
    const style = RULES.filter((entry) => entry.rule.startsWith('style-'));
    expect(style.every((entry) => entry.severity === 'warning')).toBe(true);
  });
});

describe('explain-back variety', () => {
  /** A module of `count` lessons, each ending on an explain-back framed by `frame(i)`. */
  function catalogOf(
    count: number,
    frame: (i: number) => { audience?: ExplainBackStep['audience']; kind?: ExplainBackStep['kind'] },
  ): RawCatalog {
    const catalog = validCatalog();
    const chapter = moduleOf(catalog);
    chapter.lessons = Array.from({ length: count }, (_, i) => {
      const lesson = rawLesson();
      lesson.data.id = `js.lesson-${i}`;
      Object.assign(stepOf(lesson, 'explain-back'), frame(i));
      return lesson;
    });
    return catalog;
  }

  it('warns when more than two thirds of six or more explain-backs share a frame', () => {
    const issues = validateExplainBackVariety(catalogOf(6, () => ({})));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      rule: 'explain-back-variety',
      path: 'content/course/03-javascript/module.yaml',
    });
    expect(issues[0]?.message).toContain('6 of 6');
    expect(issues[0]?.message).toContain('teammate');
  });

  it('reads an absent audience and kind as teammate and explain', () => {
    const issues = validateExplainBackVariety(
      catalogOf(6, (i) => (i < 5 ? {} : { audience: 'teammate', kind: 'explain' })),
    );
    expect(issues[0]?.message).toContain('6 of 6');
  });

  it('is quiet when the frames vary or the module is small', () => {
    expect(validateExplainBackVariety(catalogOf(5, () => ({})))).toEqual([]);
    const varied = (i: number) =>
      i % 3 === 0 ? {} : i % 3 === 1 ? { audience: 'newcomer' as const } : { kind: 'risk' as const };
    expect(validateExplainBackVariety(catalogOf(9, varied))).toEqual([]);
    // Exactly two thirds is still enough variety.
    expect(
      validateExplainBackVariety(catalogOf(6, (i) => (i < 4 ? {} : { kind: 'decide' as const }))),
    ).toEqual([]);
  });

  it('is not part of the normal validation run', () => {
    expect(rulesOf(validateCatalog(catalogOf(6, () => ({}))))).not.toContain(
      'explain-back-variety',
    );
  });
});
