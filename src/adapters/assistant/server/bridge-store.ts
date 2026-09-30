import type { AssistantContext, AssistantTurn } from '@/core/ports/assistant';

/*
 * The MCP bridge: the simulator tab and the candidate's Claude app never talk directly.
 * The tab posts its context and question here; the app reads them through MCP tools and
 * posts a reply; the tab polls for it. A session per pairing code, dropped when idle.
 *
 * Where a session lives is a backend:
 *  - memory, the default: enough for one long-running server (`pnpm dev`, the VPS);
 *  - Redis over Upstash's REST API, when UPSTASH_REDIS_REST_URL and
 *    UPSTASH_REDIS_REST_TOKEN are set: required on a serverless host such as Vercel, where
 *    the app's tool call and the tab's poll may reach different instances with no memory
 *    in common. Plain fetch, no SDK, so the VPS can use the same store (docs/DEPLOYMENT.md).
 *
 * Each call loads the session, changes it and saves it. Two writes to one session at the
 * same instant could lose one; the tab and the app take turns, so that does not happen in
 * practice, and the worst case is a reply the tab asks for again.
 */

export interface BridgeQuestion {
  id: number;
  text: string;
  /** Earlier turns, oldest first, without the question itself. */
  earlier: AssistantTurn[];
  askedAt: number;
}

export interface BridgeReply {
  /** Position in this session's replies, from 1. The tab asks for replies after n. */
  n: number;
  text: string;
  /** The question it answers, or null when the app spoke unprompted. */
  questionId: number | null;
  at: number;
}

export interface Session {
  context?: AssistantContext;
  pending?: BridgeQuestion;
  replies: BridgeReply[];
  lastQuestionId: number;
  lastReplyN: number;
  lastSeen: number;
  agentSeenAt?: number;
}

export interface SessionBackend {
  load(code: string): Promise<Session | undefined>;
  save(code: string, session: Session, ttlMs: number): Promise<void>;
}

const MAX_REPLIES = 50;
const SWEEP_EVERY_MS = 60_000;
export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

/** Sessions in this process, swept of idle ones now and then. */
export class MemoryBackend implements SessionBackend {
  private readonly sessions = new Map<string, { session: Session; expires: number }>();
  private lastSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  get size(): number {
    return this.sessions.size;
  }

  sweep(): void {
    const now = this.now();
    this.lastSweep = now;
    for (const [code, entry] of this.sessions) if (entry.expires <= now) this.sessions.delete(code);
  }

  load(code: string): Promise<Session | undefined> {
    if (this.now() - this.lastSweep >= SWEEP_EVERY_MS) this.sweep();
    const entry = this.sessions.get(code);
    if (!entry || entry.expires <= this.now()) return Promise.resolve(undefined);
    // A copy, so a caller's change counts only once it is saved, as with Redis.
    return Promise.resolve(structuredClone(entry.session));
  }

  save(code: string, session: Session, ttlMs: number): Promise<void> {
    this.sessions.set(code, { session: structuredClone(session), expires: this.now() + ttlMs });
    return Promise.resolve();
  }
}

/** Upstash's REST API: one JSON command per request, the key expiring with the session. */
export class RedisRestBackend implements SessionBackend {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async command(args: (string | number)[]): Promise<unknown> {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`The bridge store answered ${response.status}.`);
    const body = (await response.json()) as { result?: unknown; error?: string };
    if (body.error) throw new Error(`The bridge store refused: ${body.error}`);
    return body.result;
  }

  private key(code: string): string {
    return `understory:bridge:${code}`;
  }

  async load(code: string): Promise<Session | undefined> {
    const raw = await this.command(['GET', this.key(code)]);
    if (typeof raw !== 'string') return undefined;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return undefined;
    }
  }

  async save(code: string, session: Session, ttlMs: number): Promise<void> {
    await this.command(['SET', this.key(code), JSON.stringify(session), 'PX', ttlMs]);
  }
}

export interface BridgeStoreOptions {
  backend?: SessionBackend;
  /** Idle sessions are dropped after this long. */
  ttlMs?: number;
  now?: () => number;
}

export class BridgeStore {
  readonly backend: SessionBackend;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: BridgeStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    this.backend = options.backend ?? new MemoryBackend(this.now);
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  /** Loads a session, lets `change` edit it, and saves it with a fresh expiry. */
  private async update<T>(
    code: string,
    create: boolean,
    change: (session: Session) => T,
  ): Promise<T | undefined> {
    let session = await this.backend.load(code);
    if (!session) {
      if (!create) return undefined;
      session = { replies: [], lastQuestionId: 0, lastReplyN: 0, lastSeen: this.now() };
    }
    session.lastSeen = this.now();
    const result = change(session);
    await this.backend.save(code, session, this.ttlMs);
    return result;
  }

  async has(code: string): Promise<boolean> {
    return (await this.backend.load(code)) !== undefined;
  }

  /** The tab asks a question. It replaces one still waiting. */
  async ask(
    code: string,
    turns: readonly AssistantTurn[],
    context: AssistantContext,
  ): Promise<{ questionId: number; since: number }> {
    const result = await this.update(code, true, (session) => {
      session.context = context;
      const question = turns.at(-1);
      session.lastQuestionId += 1;
      session.pending = {
        id: session.lastQuestionId,
        text: question?.text ?? '',
        earlier: turns.slice(0, -1).map((turn) => ({ role: turn.role, text: turn.text })),
        askedAt: this.now(),
      };
      return { questionId: session.pending.id, since: session.lastReplyN };
    });
    return result ?? { questionId: 0, since: 0 };
  }

  /** The tab keeps the app's view of the code current between questions. */
  async putContext(code: string, context: AssistantContext): Promise<void> {
    await this.update(code, true, (session) => {
      session.context = context;
    });
  }

  context(code: string): Promise<AssistantContext | undefined> {
    return this.update(code, false, (session) => {
      session.agentSeenAt = this.now();
      return session.context;
    });
  }

  pending(code: string): Promise<BridgeQuestion | undefined> {
    return this.update(code, false, (session) => {
      session.agentSeenAt = this.now();
      return session.pending;
    });
  }

  /** The app answers. Resolves undefined when no tab has used this code. */
  reply(code: string, text: string): Promise<BridgeReply | undefined> {
    return this.update(code, false, (session) => {
      session.agentSeenAt = this.now();
      session.lastReplyN += 1;
      const reply: BridgeReply = {
        n: session.lastReplyN,
        text,
        questionId: session.pending?.id ?? null,
        at: this.now(),
      };
      delete session.pending;
      session.replies.push(reply);
      if (session.replies.length > MAX_REPLIES) session.replies.shift();
      return reply;
    });
  }

  /** The tab polls. Read-only, so a poll does not keep an abandoned session alive. */
  async repliesSince(
    code: string,
    since: number,
  ): Promise<{ replies: BridgeReply[]; agentSeenAt: number | null }> {
    const session = await this.backend.load(code);
    if (!session) return { replies: [], agentSeenAt: null };
    return {
      replies: session.replies.filter((reply) => reply.n > since),
      agentSeenAt: session.agentSeenAt ?? null,
    };
  }
}

/** Redis when configured, memory otherwise. */
export function backendFromEnv(
  env: Record<string, string | undefined> = process.env,
): SessionBackend {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? new RedisRestBackend(url, token) : new MemoryBackend();
}

// One store per server process. On globalThis so that dev hot reloads, which re-evaluate
// this module, keep the sessions a connected app is using.
const KEY = Symbol.for('understory.assistant.bridge-store');
type WithStore = typeof globalThis & { [KEY]?: BridgeStore };

export function getBridgeStore(): BridgeStore {
  const scope = globalThis as WithStore;
  scope[KEY] ??= new BridgeStore({ backend: backendFromEnv() });
  return scope[KEY];
}
