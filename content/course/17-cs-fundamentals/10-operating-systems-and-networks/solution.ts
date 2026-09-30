export type Split = { messages: string[]; rest: string };

// TCP delivers bytes, not messages. The sender ends each message with '\n', and the
// receiver keeps whatever follows the last '\n' until more bytes arrive.
export function splitMessages(pending: string, chunk: string): Split {
  const parts = (pending + chunk).split('\n');
  const rest = parts.pop() ?? '';
  return { messages: parts.filter((part) => part !== ''), rest };
}
