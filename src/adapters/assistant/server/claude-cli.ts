import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import { assistantSystemPrompt, type AssistantErrorCode } from '@/core/ports/assistant';
import { normaliseTurns, type AssistantBody, type StreamEvent } from '../protocol';

/*
 * Runs the Claude Code CLI as a plain chat model: print mode, streamed JSON with partial
 * messages, our system prompt in place of Claude Code's, no tools, no MCP servers, no
 * settings (so no hooks or plugins), nothing saved. It runs in the temp directory so no
 * project's CLAUDE.md is read into the conversation.
 */

export type Spawn = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export function claudeCommand(env: Record<string, string | undefined> = process.env): string {
  return env.CLAUDE_CLI_PATH || 'claude';
}

export function cliArgs(body: AssistantBody): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--system-prompt',
    assistantSystemPrompt(body.context),
    '--tools',
    '',
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--no-session-persistence',
    ...(body.model ? ['--model', body.model] : []),
  ];
}

/**
 * Print mode takes one prompt, so earlier turns are written out above the new question.
 * It goes in on stdin: a long conversation would overflow an argument.
 */
export function cliPrompt(turns: AssistantBody['turns']): string {
  const all = normaliseTurns(turns);
  const question = all.at(-1)?.text ?? '';
  const earlier = all.slice(0, -1);
  if (earlier.length === 0) return question;
  const history = earlier
    .map((turn) => `${turn.role === 'user' ? 'Candidate' : 'Assistant'}: ${turn.text}`)
    .join('\n\n');
  return `The conversation so far:\n\n${history}\n\nThe candidate now asks:\n\n${question}`;
}

export type CliLine =
  | { kind: 'text'; text: string }
  | { kind: 'result'; ok: true; text: string }
  | { kind: 'result'; ok: false; message: string }
  | { kind: 'other' };

/** Reads one line of `--output-format stream-json`. Anything unexpected is ignored. */
export function parseCliLine(line: string): CliLine {
  let data: unknown;
  try {
    data = JSON.parse(line);
  } catch {
    return { kind: 'other' };
  }
  if (typeof data !== 'object' || data === null) return { kind: 'other' };
  const record = data as Record<string, unknown>;
  if (record.type === 'stream_event' && record.parent_tool_use_id == null) {
    const event = record.event as
      { type?: string; delta?: { type?: string; text?: unknown } } | undefined;
    if (
      event?.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta' &&
      typeof event.delta.text === 'string'
    ) {
      return { kind: 'text', text: event.delta.text };
    }
    return { kind: 'other' };
  }
  if (record.type === 'result') {
    const text = typeof record.result === 'string' ? record.result : '';
    if (record.is_error === true || record.subtype !== 'success') {
      return { kind: 'result', ok: false, message: text };
    }
    return { kind: 'result', ok: true, text };
  }
  return { kind: 'other' };
}

/** What the CLI reported, in words a candidate can act on. */
export function cliError(message: string): { code: AssistantErrorCode; message: string } {
  if (/log ?in|logged|auth|credential|api key/i.test(message)) {
    return {
      code: 'unauthorised',
      message: 'Claude Code is not logged in. Run claude in a terminal, log in, then ask again.',
    };
  }
  if (/rate limit|usage limit|limit reached|too many/i.test(message)) {
    return {
      code: 'rate-limited',
      message: 'Your Claude account has hit its usage limit. Try again later.',
    };
  }
  return { code: 'failed', message: 'Claude Code failed to answer. Ask again.' };
}

const NOT_INSTALLED = {
  type: 'error',
  code: 'unavailable',
  message: 'Claude Code is not installed on this machine, or not on the server’s PATH.',
} as const satisfies StreamEvent;

/**
 * Streams a reply from the CLI. Aborting the signal kills the child; so does the caller
 * stopping iteration early (the browser cancelled the response).
 */
export async function* runClaudeCli(
  body: AssistantBody,
  signal: AbortSignal,
  spawn: Spawn = nodeSpawn,
  command: string = claudeCommand(),
): AsyncGenerator<StreamEvent> {
  let child: ChildProcess;
  try {
    child = spawn(command, cliArgs(body), {
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'ignore'],
      env: process.env,
    });
  } catch {
    yield NOT_INSTALLED;
    return;
  }

  let spawnFailed = false;
  const exited = new Promise<number | null>((resolve) => {
    child.once('error', () => {
      spawnFailed = true;
      resolve(null);
    });
    child.once('close', (code) => resolve(code));
  });

  const kill = () => {
    if (child.exitCode === null && !child.killed) child.kill('SIGTERM');
  };
  if (signal.aborted) kill();
  signal.addEventListener('abort', kill, { once: true });

  // A missing binary errors stdin too; the 'error' event on the child says why.
  child.stdin?.on('error', () => {});
  child.stdin?.end(cliPrompt(body.turns));

  let streamed = false;
  let finished = false;
  try {
    if (child.stdout) {
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      for await (const line of lines) {
        const parsed = parseCliLine(line);
        if (parsed.kind === 'text') {
          streamed = true;
          yield { type: 'text', text: parsed.text };
        } else if (parsed.kind === 'result') {
          finished = true;
          if (!parsed.ok) {
            yield { type: 'error', ...cliError(parsed.message) };
            return;
          }
          // Without partial messages (an older CLI) the whole reply arrives only here.
          if (!streamed && parsed.text) yield { type: 'text', text: parsed.text };
          yield { type: 'done' };
          return;
        }
      }
    }
    const code = await exited;
    if (signal.aborted) return;
    if (spawnFailed) {
      yield NOT_INSTALLED;
    } else if (!finished) {
      yield {
        type: 'error',
        code: 'failed',
        message:
          code === 0 ? 'Claude Code ended without a reply.' : 'Claude Code stopped with an error.',
      };
    }
  } finally {
    signal.removeEventListener('abort', kill);
    kill();
  }
}

/**
 * Whether `claude` runs here. Asked once a minute at most: the panel asks on every mount.
 */
let cached: { at: number; available: boolean } | undefined;

export function resetCliCache() {
  cached = undefined;
}

export function cliAvailable(
  spawn: Spawn = nodeSpawn,
  command: string = claudeCommand(),
  now: number = Date.now(),
): Promise<boolean> {
  if (cached && now - cached.at < 60_000) return Promise.resolve(cached.available);
  return new Promise((resolve) => {
    const done = (available: boolean) => {
      cached = { at: now, available };
      resolve(available);
    };
    let child: ChildProcess;
    try {
      child = spawn(command, ['--version'], { stdio: 'ignore', cwd: tmpdir() });
    } catch {
      done(false);
      return;
    }
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      done(false);
    }, 5_000);
    child.once('error', () => {
      clearTimeout(timer);
      done(false);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      done(code === 0);
    });
  });
}
