import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { pairingCodeSchema } from '../pairing';
import { getBridgeStore, type BridgeStore } from './bridge-store';

/*
 * The simulator's MCP server, for the candidate's own Claude app (Claude Code, Claude
 * Desktop). Every tool takes the pairing code shown in the assistant panel; the state
 * behind them is the bridge store. Stateless: a fresh server per HTTP request, since all
 * state is in the store and not in an MCP session.
 */

export const MCP_INSTRUCTIONS = [
  'You are the assistant inside Understory, a course that teaches software engineering. You serve two places:',
  '- the AI-assisted coding simulator, a timed practice assessment: keep replies short and precise, code only when asked, because a reviewer reads the conversation;',
  '- the study assistant beside a lesson: be a patient tutor, explain, and write code freely. get_task says which one it is.',
  'The learner gives you a pairing code shown in the assistant panel. Pass it to every tool.',
  'When asked something, call get_pending_question first, then get_task and get_code (and get_test_output when it helps).',
  'Answer with the reply tool: that is the only way your answer reaches the app. Use Markdown, with code in fenced blocks and the language named.',
  'Do not edit files or run commands for this: the learner works in the app.',
].join('\n');

const codeInput = {
  code: z
    .string()
    .describe('The pairing code shown in the simulator’s assistant panel, such as ABCD-EFGH.'),
};

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean };

function text(value: string): ToolResult {
  return { content: [{ type: 'text', text: value }] };
}

function failure(value: string): ToolResult {
  return { content: [{ type: 'text', text: value }], isError: true };
}

const UNKNOWN_CODE =
  'No simulator is using that pairing code. Check the code in the assistant panel; it changes when the tab is reopened.';

function parseCode(raw: string): string | undefined {
  const parsed = pairingCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function createAssistantMcpServer(store: BridgeStore = getBridgeStore()): McpServer {
  const server = new McpServer(
    { name: 'understory-online-test', version: '1.0.0' },
    { instructions: MCP_INSTRUCTIONS },
  );

  const withContext = async (
    raw: string,
    render: (context: NonNullable<Awaited<ReturnType<BridgeStore['context']>>>) => string,
  ): Promise<ToolResult> => {
    const code = parseCode(raw);
    const context = code ? await store.context(code) : undefined;
    if (!context) return failure(UNKNOWN_CODE);
    return text(render(context));
  };

  server.registerTool(
    'get_pending_question',
    {
      title: 'Get the pending question',
      description:
        'The question the candidate is waiting on, with the earlier conversation. Call this first.',
      inputSchema: codeInput,
      annotations: { readOnlyHint: true },
    },
    async ({ code: raw }) => {
      const code = parseCode(raw);
      if (!code || !(await store.has(code))) return failure(UNKNOWN_CODE);
      const question = await store.pending(code);
      if (!question)
        return text('No question is waiting. The candidate has not asked anything new.');
      const earlier = question.earlier
        .map((turn) => `${turn.role === 'user' ? 'Candidate' : 'Assistant'}: ${turn.text}`)
        .join('\n\n');
      return text(
        [
          earlier ? `Earlier conversation:\n\n${earlier}\n` : '',
          `Pending question:\n\n${question.text}`,
          '\nAnswer it with the reply tool.',
        ].join('\n'),
      );
    },
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get the task',
      description: 'The task the candidate is solving: title, statement and language.',
      inputSchema: codeInput,
      annotations: { readOnlyHint: true },
    },
    ({ code }) =>
      withContext(code, (context) =>
        context.mode === 'tutor'
          ? [
              `The learner is studying the lesson "${context.taskTitle}" in Understory and wants help understanding it.`,
              'Be a patient tutor: the one-sentence answer, one small example, then stop. Markdown, code in fenced blocks with the language named. British English.',
              '',
              `On screen now:\n${context.statement || '(nothing specific)'}`,
            ].join('\n')
          : context.mode === 'guide'
            ? [
                `The learner is on the "${context.taskTitle}" page of Understory, not in a lesson, and wants guidance: where to start, which option fits them, what each part is for.`,
                'Be Scout AI, the guide: two or three sentences, then one concrete next step on this page. Ask one short question when the choice depends on them. British English.',
                '',
                `The page offers:\n${context.statement || '(nothing specific)'}`,
              ].join('\n')
            : `Task: ${context.taskTitle}\nLanguage: ${context.language}\n\n${context.statement}`,
      ),
  );

  server.registerTool(
    'get_code',
    {
      title: 'Get the code',
      description: 'The candidate’s current code in the editor.',
      inputSchema: codeInput,
      annotations: { readOnlyHint: true },
    },
    ({ code }) => withContext(code, (context) => context.code || 'The editor is empty.'),
  );

  server.registerTool(
    'get_test_output',
    {
      title: 'Get the test output',
      description: 'The output of the candidate’s last test run.',
      inputSchema: codeInput,
      annotations: { readOnlyHint: true },
    },
    ({ code }) =>
      withContext(code, (context) => context.output || 'The candidate has not run the tests yet.'),
  );

  server.registerTool(
    'reply',
    {
      title: 'Reply to the candidate',
      description:
        'Sends your answer to the simulator’s assistant panel. Answers the pending question.',
      inputSchema: {
        ...codeInput,
        text: z.string().min(1).max(100_000).describe('Your answer, as plain text or Markdown.'),
      },
    },
    async ({ code: raw, text: answer }) => {
      const code = parseCode(raw);
      const reply = code ? await store.reply(code, answer) : undefined;
      if (!reply) return failure(UNKNOWN_CODE);
      return text('Sent. It is showing in the candidate’s assistant panel.');
    },
  );

  return server;
}

/** Handles one Streamable HTTP request with a server of its own. */
export async function handleMcpRequest(
  request: Request,
  store: BridgeStore = getBridgeStore(),
): Promise<Response> {
  const server = createAssistantMcpServer(store);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // With JSON responses the reply is complete once handleRequest resolves.
    void server.close();
  }
}
