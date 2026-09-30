import { completeJson, stripFences } from './json.solution';

type Review = { stars: number; summary: string };

const isReview = (value: unknown): value is Review =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { stars?: unknown }).stars === 'number' &&
  typeof (value as { summary?: unknown }).summary === 'string';

// A fake model that gives the scripted replies in turn, and records each prompt.
function scripted(replies: string[]) {
  const prompts: string[] = [];
  const complete = async (prompt: string): Promise<string> => {
    prompts.push(prompt);
    return replies[prompts.length - 1] ?? 'no more replies';
  };
  return { complete, prompts };
}

const PROMPT = 'Rate this review as JSON: "Fast delivery, box was crushed."';

test('stripFences removes a fence with or without a language', () => {
  expect(stripFences('```json\n{"stars": 3}\n```')).toBe('{"stars": 3}');
  expect(stripFences('  ```\n[1, 2]\n```  ')).toBe('[1, 2]');
  expect(stripFences('{"stars": 3}')).toBe('{"stars": 3}');
});

test('a fenced reply is parsed and checked on the first try', async () => {
  const model = scripted(['```json\n{"stars": 3, "summary": "Quick but damaged"}\n```']);
  expect(await completeJson(model.complete, PROMPT, isReview)).toEqual({ stars: 3, summary: 'Quick but damaged' });
  expect(model.prompts).toEqual([PROMPT]);
});

test('broken JSON gets one re-ask that says what was wrong', async () => {
  const model = scripted(['Sure. {stars: 3}', '{"stars": 3, "summary": "Quick but damaged"}']);
  expect(await completeJson(model.complete, PROMPT, isReview)).toEqual({ stars: 3, summary: 'Quick but damaged' });
  expect(model.prompts).toHaveLength(2);
  expect(model.prompts[1]).toContain(PROMPT);
  expect(model.prompts[1]).toContain('not valid JSON');
});

test('valid JSON of the wrong shape is re-asked too', async () => {
  const model = scripted(['{"rating": "3/5"}', '{"stars": 3, "summary": "Quick but damaged"}']);
  expect(await completeJson(model.complete, PROMPT, isReview)).toEqual({ stars: 3, summary: 'Quick but damaged' });
  expect(model.prompts[1]).toContain('wrong shape');
});

test('two bad replies throw, and there is no third call', async () => {
  const model = scripted(['{"rating": "3/5"}', 'I cannot rate this.', '{"stars": 3, "summary": "late"}']);
  let message = '';
  try {
    await completeJson(model.complete, PROMPT, isReview);
  } catch (error) {
    message = (error as Error).message;
  }
  expect(message).toContain('not valid JSON');
  expect(model.prompts).toHaveLength(2);
});
