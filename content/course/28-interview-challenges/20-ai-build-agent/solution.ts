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

// Returns an error message the model can act on, or the parsed output.
function check(text: string): Final | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return 'not valid JSON';
  }
  if (typeof data !== 'object' || data === null) return 'expected a JSON object';
  const { answer, sources } = data as Record<string, unknown>;
  if (typeof answer !== 'string') return 'answer must be a string';
  if (!Array.isArray(sources) || !sources.every((s) => typeof s === 'string')) {
    return 'sources must be an array of strings';
  }
  return { answer, sources };
}

async function runCall(call: ToolCall, tools: Record<string, Tool>, approve: Options['approve']) {
  // Own-property check, so a name like "toString" can't reach the prototype.
  const tool = Object.hasOwn(tools, call.name) ? tools[call.name] : undefined;
  if (!tool) return { content: `Unknown tool: ${call.name}`, isError: true };
  if (tool.write && !(await approve(call))) return { content: 'Not approved by the user', isError: true };
  try {
    return { content: await tool.run(call.input), isError: false };
  } catch (error) {
    // An error goes back as a result: the model can often recover, a crash cannot.
    return { content: `Error: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
}

export async function runAgent(model: Model, tools: Record<string, Tool>, options: Options): Promise<Result> {
  const messages: Message[] = [{ role: 'user', content: options.task }];
  let retries = 0;
  for (let step = 1; step <= options.maxSteps; step++) {
    const reply = await model(messages);
    messages.push({ role: 'assistant', reply });
    if (reply.type === 'final') {
      const checked = check(reply.text);
      if (typeof checked !== 'string') return { status: 'done', output: checked, steps: step };
      retries++;
      if (retries > options.maxRetries) return { status: 'fallback', output: options.fallback, steps: step };
      messages.push({ role: 'user', content: `Invalid output: ${checked}. Reply with JSON {"answer": string, "sources": string[]}.` });
      continue;
    }
    for (const call of reply.calls) {
      const result = await runCall(call, tools, options.approve);
      // Tool text stays a tool message: data for the model to read, never new instructions.
      messages.push({ role: 'tool', callId: call.id, ...result });
    }
  }
  return { status: 'stopped', output: options.fallback, steps: options.maxSteps };
}
