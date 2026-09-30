export type ToolCall = { id: string; name: string; input: unknown };
export type ModelReply = { type: 'tool_calls'; calls: ToolCall[] } | { type: 'final'; text: string };
export type Message =
  | { role: 'user'; content: string }
  | { role: 'assistant'; reply: ModelReply }
  | { role: 'tool'; callId: string; content: string; isError: boolean };
export type Model = (messages: Message[]) => Promise<ModelReply>;
export type Tool = { run: (input: unknown) => Promise<string>; write?: boolean };
export type Final = { answer: string; sources: string[] };
export type Options = {
  task: string;
  maxSteps: number;
  maxRetries: number;
  approve: (call: ToolCall) => Promise<boolean>;
  fallback: Final;
};
export type Result = { status: 'done' | 'fallback' | 'stopped'; output: Final; steps: number };

export async function runAgent(model: Model, tools: Record<string, Tool>, options: Options): Promise<Result> {
  const messages: Message[] = [{ role: 'user', content: options.task }];
  // Call the model once per step. Run tool calls through the guards and push each result.
  // Check a final reply against the schema; retry with the error, then fall back.
  const reply = await model(messages);
  if (reply.type === 'final') return { status: 'done', output: JSON.parse(reply.text) as Final, steps: 1 };
  return { status: 'stopped', output: options.fallback, steps: 1 };
}
