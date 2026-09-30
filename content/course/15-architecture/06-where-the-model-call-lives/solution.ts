export type Label = 'refund' | 'bug' | 'other';
export type Route = 'billing' | 'engineering' | 'inbox';

// The port: what the rules need from a model.
export interface Classifier {
  classify(ticket: string): Promise<Label>;
}

// Sends a JSON body to a provider's API and resolves with the parsed reply.
export type Send = (body: unknown) => Promise<unknown>;

// The rule knows labels and routes. Prompts and reply shapes live in the adapters.
export async function routeTicket(ticket: string, model: Classifier): Promise<Route> {
  const label = await model.classify(ticket);
  if (label === 'refund') return 'billing';
  if (label === 'bug') return 'engineering';
  return 'inbox';
}

const PROMPT = 'Label as refund, bug or other: ';

// A model can answer anything, so anything that isn't a known label becomes 'other'.
function toLabel(text: unknown): Label {
  const word = typeof text === 'string' ? text.trim().toLowerCase() : '';
  return word === 'refund' || word === 'bug' ? word : 'other';
}

// Provider A takes { prompt } and replies { output: [{ text: 'refund' }] }.
export function providerA(send: Send): Classifier {
  return {
    async classify(ticket) {
      const reply = (await send({ prompt: PROMPT + ticket })) as {
        output?: { text?: unknown }[];
      };
      return toLabel(reply.output?.[0]?.text);
    },
  };
}

// Provider B takes { messages: [{ role: 'user', content }] }
// and replies { choices: [{ message: { content: 'bug' } }] }.
export function providerB(send: Send): Classifier {
  return {
    async classify(ticket) {
      const body = { messages: [{ role: 'user', content: PROMPT + ticket }] };
      const reply = (await send(body)) as {
        choices?: { message?: { content?: unknown } }[];
      };
      return toLabel(reply.choices?.[0]?.message?.content);
    },
  };
}
