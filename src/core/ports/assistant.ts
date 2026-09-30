/*
 * The AI assistant in Understory: in the AI-assisted coding simulator and beside every lesson, reached through
 * one of three providers (docs/ONLINE-TEST.md, "Assistant"):
 *
 *  - `api-key`: the candidate's own Anthropic API key, kept in this browser and sent per
 *    request to a same-origin route that streams from the Messages API;
 *  - `claude-cli`: the Claude account logged in on this machine, through a local-only
 *    route that runs `claude -p`;
 *  - `mcp`: the candidate's own Claude app (Claude Code, Claude Desktop), connected to the
 *    simulator's MCP endpoint; the app reads the task and code and answers through a tool.
 *
 * Every provider sees the same context and yields the reply as it arrives, so the panel
 * and the transcript in the report do not care which one answered.
 */

export type AssistantProviderId = 'api-key' | 'claude-cli' | 'mcp';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** What the assistant may see, as an assessment's built-in assistant sees the open task and editor. */
export interface AssistantContext {
  taskTitle: string;
  /** The statement as plain text, signature included. */
  statement: string;
  language: string;
  code: string;
  /** The last Test Output as text, or empty before the first run. */
  output: string;
  /**
   * `test`, the default: the assistant inside a timed assessment, brief, its transcript read
   * by the reviewer. `tutor`: the study assistant beside a lesson, which explains and writes
   * code freely. `taskTitle` and `statement` then hold the lesson and what is on screen.
   * `guide`: the same assistant on any other page, where the question is where to go and
   * which option fits. `taskTitle` and `statement` then hold the page and what it offers.
   */
  mode?: 'test' | 'tutor' | 'guide';
}

export interface AssistantRequest {
  /** Earlier turns, oldest first. The last one is the new question. */
  turns: AssistantTurn[];
  context: AssistantContext;
}

export interface AssistantSignal {
  readonly aborted: boolean;
  addEventListener?(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
}

export interface AssistantPort {
  readonly id: AssistantProviderId;
  /** Text chunks as they arrive. Throws an AssistantError the panel can show. */
  send(request: AssistantRequest, signal?: AssistantSignal): AsyncIterable<string>;
}

export type AssistantErrorCode = 'unauthorised' | 'unavailable' | 'rate-limited' | 'failed';

export class AssistantError extends Error {
  constructor(
    readonly code: AssistantErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantError';
  }
}

/**
 * The system prompt every provider uses. A general assistant that does not refuse, like
 * the platform's: the point of practice is learning to ask it good questions, and the
 * report shows each question as the reviewer would read it.
 */
export function assistantSystemPrompt(context: AssistantContext): string {
  if (context.mode === 'tutor') return tutorSystemPrompt(context);
  if (context.mode === 'guide') return guideSystemPrompt(context);
  return [
    'You are the AI assistant built into an online coding assessment.',
    'The candidate is solving the task below under a time limit. Answer what they ask, briefly and precisely.',
    'Prefer short answers: a sentence or two, and code only when asked for it.',
    'Their conversation with you is recorded and read by the reviewer.',
    '',
    `Task: ${context.taskTitle}`,
    context.statement,
    '',
    `Language: ${context.language}`,
    'Current code:',
    context.code,
    ...(context.output ? ['', 'Last test output:', context.output] : []),
  ].join('\n');
}

/**
 * The study assistant: a patient tutor beside the lesson. It explains for a learner who may
 * be new to the idea, answers in Markdown with code in fenced blocks, and shows code freely,
 * because here understanding is the goal and nobody is being assessed.
 */
function tutorSystemPrompt(context: AssistantContext): string {
  return [
    'You are the study assistant in Understory, a course that teaches software engineering from a first line of code to production systems.',
    'The learner is studying the lesson below and asks you for help. Explain clearly and concretely for someone who may be new to the idea.',
    'Start with the one-sentence answer, then one small example, then stop. Offer to go deeper rather than writing an essay.',
    'Use Markdown. Put code in fenced blocks with the language named (```ts, ```python). Keep examples short and runnable.',
    'If the learner is working on an exercise, help them think it through first: a hint, then a nudge, and the full answer when they ask for it.',
    'Use British English.',
    '',
    `Lesson: ${context.taskTitle}`,
    ...(context.statement ? ['On screen now:', context.statement] : []),
    ...(context.code
      ? ['', `The learner's code (${context.language || 'code'}):`, context.code]
      : []),
    ...(context.output ? ['', 'Their last run:', context.output] : []),
  ].join('\n');
}

/**
 * The same assistant away from a lesson: a guide to the course. It helps the learner choose
 * where to start and which option on the page fits them, and says how the parts connect.
 */
function guideSystemPrompt(context: AssistantContext): string {
  return [
    'You are Scout AI, the guide in Understory, a course that teaches software engineering from a first line of code to production systems.',
    'The learner is on the page below, not in a lesson. Help them decide where to start, which option fits them, and what each part of the app is for.',
    'Ask one short question when the right choice depends on them: what they already know, their goal, their time.',
    'Answer in two or three sentences, then name one concrete next step on this page. Offer more rather than writing an essay.',
    'Use Markdown sparingly. Use British English.',
    '',
    `Page: ${context.taskTitle}`,
    ...(context.statement ? ['On screen now:', context.statement] : []),
  ].join('\n');
}
