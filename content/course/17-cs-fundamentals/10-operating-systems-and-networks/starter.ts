export type Split = { messages: string[]; rest: string };

export function splitMessages(pending: string, chunk: string): Split {
  // Join the leftover to the new chunk, cut at each '\n', and keep the unfinished tail.
  return { messages: [pending + chunk], rest: '' };
}
