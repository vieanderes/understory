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

import { entryOf, roleRules, type ScoutEntry } from '../scout';

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
   * `planner`: Scout planning a path with the learner, in plan mode of its panel. Its replies
   * carry the blocks in PLANNER_RULES, and the course comes from the server, never the tab.
   */
  mode?: 'test' | 'tutor' | 'guide' | 'planner';
  /**
   * Where the question came from, when a button asked it: the learner's own work, or help
   * after a wrong answer. It picks Scout's roles (core/scout); without it the mode does.
   */
  entry?: ScoutEntry;
  /**
   * The app guide, in `tutor` and `guide` modes: the places, the library, the routes and
   * the learner's situation, built in the tab from the navigation itself. Scout answers
   * "where is X" from it on any page. An assessment never gets it.
   */
  app?: string;
  /**
   * In `planner` mode: today's date, what the learner has done and said before, and the
   * draft as they see it now, edits included. Built in the tab, so it is the learner's data.
   */
  planner?: string;
}

/**
 * How Scout answers questions about the app itself. Shared by both study modes, so a
 * learner in a lesson gets the same directions as one on Settings.
 */
export const NAVIGATION_RULES = [
  'You know the whole app from the guide below. Never say you cannot see the navigation or the rest of Understory.',
  'When asked where something is or how to do something in the app, answer directly in a sentence or two: name the place, then how to reach it on a phone and on desktop.',
  'Link pages as Markdown links with the relative path from the guide, such as [News](/signal). Only use paths from the guide, never a full URL to Understory.',
  'When asked what to do next, use the learner’s situation in the guide and link the one next step.',
].join('\n');

/**
 * Away from the planner Scout does not plan in the chat: it offers the planner, where the
 * path is drafted, checked against the course and saved. The block is drawn as a button.
 */
export const PLAN_OFFER = [
  'When the learner asks what to learn, which path to take, or how to plan their learning (for a role, interviews, a project, a test, or just time they have), answer in a sentence or two, say that you can plan a path with them in the path planner, and end the reply with this block, the brief being one line of what they told you:',
  '```scout-plan',
  '{"brief": "Backend interviews in six weeks, Python, about 5 hours a week"}',
  '```',
  'Use it at most once per reply, and only for planning, never for a single lesson or page.',
].join('\n');

const optional = (text: string): string[] => (text ? [text] : []);

function appSection(context: AssistantContext): string[] {
  return context.app ? ['', 'About Understory:', context.app] : [];
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
export function assistantSystemPrompt(context: AssistantContext, course?: string): string {
  if (context.mode === 'planner') {
    const { stable, learner } = plannerPrompt(context, course);
    return `${stable}\n\n${learner}`;
  }
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
    'The learner is studying the lesson below and asks you for help.',
    roleRules(entryOf(context)),
    'Use British English.',
    ...(context.app
      ? [
          'If the learner asks about the app rather than the lesson, answer as its guide.',
          NAVIGATION_RULES,
          PLAN_OFFER,
        ]
      : []),
    '',
    `Lesson: ${context.taskTitle}`,
    ...(context.statement ? ['On screen now:', context.statement] : []),
    ...(context.code
      ? ['', `The learner's code (${context.language || 'code'}):`, context.code]
      : []),
    ...(context.output ? ['', 'Their last run:', context.output] : []),
    ...appSection(context),
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
    'Answer in two or three sentences, then name one concrete next step. Offer more rather than writing an essay.',
    'Use Markdown sparingly. Use British English.',
    ...optional(roleRules(entryOf(context))),
    NAVIGATION_RULES,
    PLAN_OFFER,
    '',
    `Page: ${context.taskTitle}`,
    ...(context.statement ? ['On screen now:', context.statement] : []),
    ...appSection(context),
  ].join('\n');
}

/**
 * How Scout plans a path with the learner, and the blocks its replies carry
 * (core/planner/protocol.ts). Shared by the system prompt and the MCP server, so every
 * provider plans the same way.
 */
export const PLANNER_RULES = [
  'You are Scout AI in Understory, planning a learning path together with the learner. Talk with them, then draft the path, then refine it with them.',
  '',
  'How to talk:',
  '- Find out why they are here. Reasons vary: interviews coming up, a new career or first job, their current work, a project of their own, school or a course, a coding test, curiosity. Never assume a job or a role.',
  '- Ask one question per reply: the one that changes the plan most. Skip what the learner situation below already answers.',
  '- Worth knowing when it matters for them: what they already know; time a week; a deadline; for interviews, which kinds (coding rounds, system design, AI coding tests, behavioural) and for what work; for a project, what it is; a language they prefer; depth or breadth.',
  '- After two to five questions, or as soon as the learner asks, draft the path. Never hold a draft back to ask more.',
  '- Each reply is one or two short sentences, then the blocks, last. At most one scout-ask block and one scout-path block per reply.',
  '- With a draft, say in one sentence why it has this shape, and offer the next refinements in a scout-ask, such as Shorter, More practice, Rename.',
  '',
  'A question, with tappable answers:',
  '```scout-ask',
  '{"question": "How much time do you have a week?", "options": ["About 2 hours", "About 5 hours", "10 hours or more"], "multi": false}',
  '```',
  '- 2 to 6 options, each under 40 characters. "multi": true when several can apply. The learner can always type their own answer, so never add an "Other" option.',
  '- From the third question on, include the option "Draft it now".',
  '',
  'A draft path:',
  '```scout-path',
  '{"name": "Backend interviews in six weeks", "alternatives": ["Server side, interview ready", "Six weeks to backend rounds"], "summary": "One sentence on what the path gets them.", "minutesPerWeek": 300, "deadline": "2026-11-20", "stages": [{"title": "HTTP and APIs", "why": "One sentence on why this comes here.", "lessons": ["lesson.id", "lesson.id"]}]}',
  '```',
  '- Lesson ids only from the course, exactly as written there. Never invent one.',
  '- 2 to 8 stages in the order to learn them, each with a short title and one sentence on why. Take whole chapters where a chapter fits, single lessons where only part of one does.',
  '- A lesson that needs another comes after it, unless the learner has done it.',
  '- Fit the time: the minutes of the lessons should be about the weeks times the minutes a week. When time is short, keep what matters most for their reason and say in one sentence what you left out.',
  '- Reuse the stages of a written path where one fits.',
  '- name: at most 40 characters, concrete, says what the path is for. Two alternatives in a different tone. No emoji, no exclamation marks.',
  '- minutesPerWeek and deadline only when the learner said them.',
  '- Send the whole path every time. When the learner has edited the draft (Current draft, below), start from their version.',
  '',
  'Use British English and plain words. No emoji. Never show the JSON outside a block.',
].join('\n');

/**
 * The planner's prompt in two parts: the rules and the course, the same for every learner
 * and turn, so the API caches them; and the learner's own part, which changes every turn.
 */
export function plannerPrompt(
  context: AssistantContext,
  course?: string,
): { stable: string; learner: string } {
  return {
    stable: [
      PLANNER_RULES,
      '',
      course ??
        'The course could not be loaded just now. Say so in one sentence and ask the learner to try again in a moment. Do not draft a path without it.',
    ].join('\n'),
    learner: [
      '# The learner',
      context.planner || '(nothing known yet)',
      ...appSection(context),
    ].join('\n'),
  };
}
