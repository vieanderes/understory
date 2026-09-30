import { REFUSAL, runEvals } from './solution';
import type { EvalCase, SystemOutput } from './solution';

// A fake system: a lookup from question to a scripted output.
function fake(outputs: Record<string, SystemOutput>) {
  return async (question: string) => {
    const out = outputs[question];
    if (!out) throw new Error(`no script for ${question}`);
    return out;
  };
}

const opens: EvalCase = { id: 'opens', question: 'When does the library open?', relevant: ['hours#0'], mustInclude: ['9am'] };
const fines: EvalCase = { id: 'fines', question: 'What is the late fine?', relevant: ['fees#2', 'fees#3'], mustInclude: ['20p'] };
const parking: EvalCase = { id: 'parking', question: 'Is there parking?', relevant: [], mustInclude: [] };

test('a perfect run scores 1 everywhere with no failures', async () => {
  const system = fake({
    [opens.question]: { retrieved: ['hours#0', 'fees#2'], answer: 'It opens at 9am.', citations: ['hours#0'] },
    [parking.question]: { retrieved: ['hours#0'], answer: REFUSAL, citations: [] },
  });
  expect(await runEvals([opens, parking], system, 3)).toEqual({ recallAtK: 1, mrr: 1, refusalAccuracy: 1, failures: [] });
});

test('recall and reciprocal rank count only the top k', async () => {
  const system = fake({
    [opens.question]: { retrieved: ['fees#2', 'hours#0'], answer: 'Opens 9AM.', citations: ['hours#0'] },
    [fines.question]: { retrieved: ['hours#0', 'hours#1', 'fees#3', 'fees#2'], answer: 'It is 20p a day.', citations: ['fees#3'] },
  });
  const report = await runEvals([opens, fines], system, 3);
  // opens: recall 1, rank 2. fines: one of two relevant in the top 3, rank 3.
  expect(report.recallAtK).toBeCloseTo(0.75, 5);
  expect(report.mrr).toBeCloseTo((1 / 2 + 1 / 3) / 2, 5);
  expect(report.failures).toEqual([]);
});

test('refusal cases stay out of the retrieval metrics', async () => {
  const system = fake({
    [opens.question]: { retrieved: ['hours#0'], answer: 'At 9am.', citations: ['hours#0'] },
    [parking.question]: { retrieved: ['fees#2'], answer: REFUSAL, citations: [] },
  });
  const report = await runEvals([opens, parking], system, 1);
  expect(report.recallAtK).toBe(1);
  expect(report.mrr).toBe(1);
});

test('refusal accuracy counts both wrong refusals and missing ones', async () => {
  const system = fake({
    [opens.question]: { retrieved: ['hours#0'], answer: ` ${REFUSAL} `, citations: [] },
    [fines.question]: { retrieved: ['fees#2'], answer: 'It is 20p.', citations: ['fees#2'] },
    [parking.question]: { retrieved: [], answer: 'Yes, there are 40 spaces.', citations: [] },
  });
  const report = await runEvals([opens, fines, parking], system, 3);
  expect(report.refusalAccuracy).toBeCloseTo(1 / 3, 5);
  expect(report.failures).toEqual([
    { id: 'opens', reason: 'should answer' },
    { id: 'parking', reason: 'should refuse' },
  ]);
});

test('answer checks: a missing fact, then a missing citation', async () => {
  const system = fake({
    [opens.question]: { retrieved: ['hours#0'], answer: 'It opens in the morning.', citations: ['hours#0'] },
    [fines.question]: { retrieved: ['fees#2'], answer: 'The fine is 20p a day.', citations: [] },
  });
  const report = await runEvals([opens, fines], system, 3);
  expect(report.failures).toEqual([
    { id: 'opens', reason: 'missing: 9am' },
    { id: 'fines', reason: 'no citation' },
  ]);
});

test('a retrieval miss scores zero without breaking the answer checks', async () => {
  const system = fake({
    [opens.question]: { retrieved: ['fees#2', 'fees#3'], answer: 'It opens at 9am.', citations: ['fees#2'] },
  });
  expect(await runEvals([opens], system, 2)).toEqual({ recallAtK: 0, mrr: 0, refusalAccuracy: 1, failures: [] });
});
