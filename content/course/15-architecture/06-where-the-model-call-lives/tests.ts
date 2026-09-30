import { routeTicket, providerA, providerB, type Classifier, type Label } from './solution';

// A fake model for the rules: no network, the same answer every time.
function fakeModel(label: Label): Classifier & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    classify: async (ticket) => {
      seen.push(ticket);
      return label;
    },
  };
}

// A fake provider API: records what was sent and replies with a fixed body.
function fakeSend(reply: unknown) {
  const sent: unknown[] = [];
  const send = async (body: unknown) => {
    sent.push(body);
    return reply;
  };
  return { send, sent };
}

const ticket = 'I was charged twice';

test('the rule routes by label, with a fake model', async () => {
  expect(await routeTicket(ticket, fakeModel('refund'))).toBe('billing');
  expect(await routeTicket(ticket, fakeModel('bug'))).toBe('engineering');
  expect(await routeTicket(ticket, fakeModel('other'))).toBe('inbox');
});

test('the rule passes the ticket to the model', async () => {
  const model = fakeModel('other');
  await routeTicket(ticket, model);
  expect(model.seen).toEqual([ticket]);
});

test('provider A: sends the prompt and reads output', async () => {
  const api = fakeSend({ output: [{ text: ' Refund\n' }] });
  expect(await providerA(api.send).classify(ticket)).toBe('refund');
  expect(api.sent).toEqual([{ prompt: `Label as refund, bug or other: ${ticket}` }]);
});

test('provider B: sends messages and reads choices', async () => {
  const api = fakeSend({ choices: [{ message: { content: 'bug' } }] });
  expect(await providerB(api.send).classify(ticket)).toBe('bug');
  expect(api.sent).toEqual([
    { messages: [{ role: 'user', content: `Label as refund, bug or other: ${ticket}` }] },
  ]);
});

test('an answer that is not a label becomes other', async () => {
  const chatty = fakeSend({ choices: [{ message: { content: 'I think this is a refund' } }] });
  expect(await providerB(chatty.send).classify(ticket)).toBe('other');
  const empty = fakeSend({ output: [] });
  expect(await providerA(empty.send).classify(ticket)).toBe('other');
});

test('swapping provider changes nothing in the rule', async () => {
  const b = fakeSend({ choices: [{ message: { content: 'refund' } }] });
  expect(await routeTicket(ticket, providerB(b.send))).toBe('billing');
});
