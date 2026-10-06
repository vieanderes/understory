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
 *
 * Two credentials guard a session, one per side (docs/ONLINE-TEST.md, "How it stays safe"):
 *  - the tab's secret, which never leaves the browser. Only its hash is kept. Asking,
 *    pushing context, reading replies and allowing a connection all need it, so the
 *    pairing code alone cannot plant a question or read the conversation;
 *  - the app's MCP connection. The pairing code lets a connection ask to join; the learner
 *    allows it in the panel, and from then on only that connection is served.
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

/** A Claude app's MCP connection, by the id the server gave it at initialize. */
export interface BridgeConnection {
  id: string;
  at: number;
}

export interface Session {
  /** SHA-256 of the tab's secret, hex. */
  secretHash?: string;
  /** The connection the learner allowed: the only one served. */
  allowed?: BridgeConnection;
  /** A connection waiting for the learner to allow it. */
  request?: BridgeConnection;
  /** Connections the learner refused, newest last, so they are not asked about again. */
  denied?: string[];
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
  remove(code: string): Promise<void>;
}

/**
 * Plain keys beside the sessions, for the MCP connections and the rate limits: shared by
 * every instance when Redis is configured, like the sessions.
 */
export interface KeyValue {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Adds one and returns the count. A new key expires ttlMs after it was made. */
  increment(key: string, ttlMs: number): Promise<number>;
}

const MAX_REPLIES = 50;
const MAX_DENIED = 10;
const SWEEP_EVERY_MS = 60_000;
/** Short, so an abandoned code stops working soon. Every push from the tab renews it. */
export const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * How long an app that keeps listening goes on after the tab last said it is open. The tab
 * says so at most once a minute while its panel is on screen, and with every question.
 */
export const TAB_OPEN_MS = 60 * 60 * 1000;
const tabKey = (code: string) => `tab:${code}`;

export type TabResult<T> = { ok: true; value: T } | { ok: false; reason: 'forbidden' };

/** Where a connection stands with a session, from the app's side. */
export type ConnectionState = 'unknown-code' | 'allowed' | 'pending' | 'denied';

/** Where the connection stands, from the tab's side. */
export interface ConnectionStatus {
  allowed: BridgeConnection | null;
  request: BridgeConnection | null;
}

/** SHA-256, hex: the store keeps a hash, so reading the store does not give the secret. */
export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Compares every character, so the time taken says nothing about how much matched. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** Sessions and keys in this process, swept of idle ones now and then. */
export class MemoryBackend implements SessionBackend, KeyValue {
  private readonly sessions = new Map<string, { session: Session; expires: number }>();
  private readonly values = new Map<string, { value: string; expires: number }>();
  private lastSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  get size(): number {
    return this.sessions.size;
  }

  sweep(): void {
    const now = this.now();
    this.lastSweep = now;
    for (const [code, entry] of this.sessions) if (entry.expires <= now) this.sessions.delete(code);
    for (const [key, entry] of this.values) if (entry.expires <= now) this.values.delete(key);
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

  remove(code: string): Promise<void> {
    this.sessions.delete(code);
    return Promise.resolve();
  }

  get(key: string): Promise<string | undefined> {
    if (this.now() - this.lastSweep >= SWEEP_EVERY_MS) this.sweep();
    const entry = this.values.get(key);
    return Promise.resolve(entry && entry.expires > this.now() ? entry.value : undefined);
  }

  set(key: string, value: string, ttlMs: number): Promise<void> {
    this.values.set(key, { value, expires: this.now() + ttlMs });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.values.delete(key);
    return Promise.resolve();
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const entry = this.values.get(key);
    if (!entry || entry.expires <= this.now()) {
      this.values.set(key, { value: '1', expires: this.now() + ttlMs });
      return 1;
    }
    entry.value = String(Number(entry.value) + 1);
    return Number(entry.value);
  }
}

/** Upstash's REST API: one JSON command per request, the key expiring with the session. */
export class RedisRestBackend implements SessionBackend, KeyValue {
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

  async remove(code: string): Promise<void> {
    await this.command(['DEL', this.key(code)]);
  }

  async get(key: string): Promise<string | undefined> {
    const raw = await this.command(['GET', `understory:${key}`]);
    return typeof raw === 'string' ? raw : undefined;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    await this.command(['SET', `understory:${key}`, value, 'PX', ttlMs]);
  }

  async delete(key: string): Promise<void> {
    await this.command(['DEL', `understory:${key}`]);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const count = Number(await this.command(['INCR', `understory:${key}`]));
    // The first count starts the window. PEXPIRE ... NX would leave a key with no expiry
    // if this second call failed, so it is set whenever a count is 1.
    if (count === 1) await this.command(['PEXPIRE', `understory:${key}`, ttlMs]);
    return count;
  }
}

export interface BridgeStoreOptions {
  backend?: SessionBackend & KeyValue;
  /** Idle sessions are dropped after this long. */
  ttlMs?: number;
  now?: () => number;
}

export class BridgeStore {
  readonly backend: SessionBackend & KeyValue;
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

  /**
   * A change from the tab. The first tab to use a code makes the session and sets its
   * secret; after that the secret must match. A read neither makes a session nor saves
   * one, so a poll does not keep an abandoned session alive.
   */
  private async fromTab<T>(
    code: string,
    secret: string,
    mode: 'read' | 'write' | 'create',
    change: (session: Session) => T,
  ): Promise<TabResult<T | undefined>> {
    const hash = await hashSecret(secret);
    let session = await this.backend.load(code);
    if (session?.secretHash && !sameHash(session.secretHash, hash)) {
      return { ok: false, reason: 'forbidden' };
    }
    if (!session) {
      if (mode !== 'create') return { ok: true, value: undefined };
      session = { replies: [], lastQuestionId: 0, lastReplyN: 0, lastSeen: this.now() };
    }
    session.secretHash ??= hash;
    const value = change(session);
    if (mode !== 'read') {
      session.lastSeen = this.now();
      await this.backend.save(code, session, this.ttlMs);
      await this.backend.set(tabKey(code), String(this.now()), TAB_OPEN_MS);
    }
    return { ok: true, value };
  }

  /** The tab asks a question. It replaces one still waiting. */
  async ask(
    code: string,
    secret: string,
    turns: readonly AssistantTurn[],
    context: AssistantContext,
  ): Promise<TabResult<{ questionId: number; since: number }>> {
    const result = await this.fromTab(code, secret, 'create', (session) => {
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
    return result.ok ? { ok: true, value: result.value ?? { questionId: 0, since: 0 } } : result;
  }

  /** The tab keeps the app's view of the code current between questions. */
  async putContext(
    code: string,
    secret: string,
    context: AssistantContext,
  ): Promise<TabResult<undefined>> {
    return this.fromTab(code, secret, 'create', (session) => {
      session.context = context;
      return undefined;
    });
  }

  /** The learner allows or refuses the connection waiting on this session. */
  async decide(
    code: string,
    secret: string,
    connectionId: string,
    allow: boolean,
  ): Promise<TabResult<boolean>> {
    const result = await this.fromTab(code, secret, 'write', (session) => {
      if (session.request?.id !== connectionId) return false;
      if (allow) session.allowed = { id: connectionId, at: this.now() };
      else session.denied = [...(session.denied ?? []), connectionId].slice(-MAX_DENIED);
      delete session.request;
      return true;
    });
    return result.ok ? { ok: true, value: result.value ?? false } : result;
  }

  /** The tab closes the session: a new code, or the learner is done. */
  async end(code: string, secret: string): Promise<TabResult<undefined>> {
    const check = await this.fromTab(code, secret, 'read', () => undefined);
    if (check.ok) {
      await this.backend.remove(code);
      await this.backend.delete(tabKey(code));
    }
    return check;
  }

  /**
   * The tab says it is still open. A small key of its own, so the session's expiry is left
   * alone and an app listening for questions knows when to stop.
   */
  async tabOpen(code: string, secret: string): Promise<TabResult<undefined>> {
    const check = await this.fromTab(code, secret, 'read', () => undefined);
    if (check.ok) await this.backend.set(tabKey(code), String(this.now()), TAB_OPEN_MS);
    return check;
  }

  /** Whether the tab has said it is open lately. */
  async isTabOpen(code: string): Promise<boolean> {
    return (await this.backend.get(tabKey(code))) !== undefined;
  }

  /**
   * The waiting question without saving anything, for an app that checks every few
   * seconds: a read costs one lookup and leaves the session's expiry alone. Null when the
   * session is gone.
   */
  async peek(code: string): Promise<{ pending: BridgeQuestion | undefined } | null> {
    const session = await this.backend.load(code);
    return session ? { pending: session.pending } : null;
  }

  /** The tab polls. Read-only, so a poll does not keep an abandoned session alive. */
  async repliesSince(
    code: string,
    secret: string,
    since: number,
  ): Promise<
    TabResult<{ replies: BridgeReply[]; agentSeenAt: number | null; connection: ConnectionStatus }>
  > {
    const result = await this.fromTab(code, secret, 'read', (session) => ({
      replies: session.replies.filter((reply) => reply.n > since),
      agentSeenAt: session.agentSeenAt ?? null,
      connection: { allowed: session.allowed ?? null, request: session.request ?? null },
    }));
    if (!result.ok) return result;
    return {
      ok: true,
      value: result.value ?? {
        replies: [],
        agentSeenAt: null,
        connection: { allowed: null, request: null },
      },
    };
  }

  /**
   * The app's connection asks to use a code. An unknown connection is recorded as the one
   * waiting for the learner, replacing any earlier request; an allowed one is served.
   */
  async connect(code: string, connectionId: string): Promise<ConnectionState> {
    const state = await this.update(code, false, (session): ConnectionState => {
      if (session.allowed?.id === connectionId) return 'allowed';
      if (session.denied?.includes(connectionId)) return 'denied';
      if (session.request?.id !== connectionId) {
        session.request = { id: connectionId, at: this.now() };
      }
      return 'pending';
    });
    return state ?? 'unknown-code';
  }

  /** Where a connection stands, without recording anything. */
  async connectionState(code: string, connectionId: string): Promise<ConnectionState> {
    const session = await this.backend.load(code);
    if (!session) return 'unknown-code';
    if (session.allowed?.id === connectionId) return 'allowed';
    if (session.denied?.includes(connectionId)) return 'denied';
    return session.request?.id === connectionId ? 'pending' : 'denied';
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
}

type Env = Record<string, string | undefined>;

function redisFromEnv(env: Env): { url: string; token: string } | undefined {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : undefined;
}

/** Redis when configured, memory otherwise. */
export function backendFromEnv(env: Env = process.env): SessionBackend & KeyValue {
  const redis = redisFromEnv(env);
  return redis ? new RedisRestBackend(redis.url, redis.token) : new MemoryBackend();
}

/**
 * On Vercel the tab's route and the app's route run as separate functions with no memory
 * in common, so without Redis the app never finds the tab's code and the tab waits out
 * its five minutes. Better to say so on the first request.
 */
export function sharedStoreMissing(env: Env = process.env): boolean {
  return Boolean(env.VERCEL) && !redisFromEnv(env);
}

// One store per server process. On globalThis so that dev hot reloads, which re-evaluate
// this module, keep the sessions a connected app is using.
const KEY = Symbol.for('understory.assistant.bridge-store');
type WithStore = typeof globalThis & { [KEY]?: BridgeStore };

export function getBridgeStore(): BridgeStore {
  const scope = globalThis as WithStore;
  // Typed loosely: after a reload it may be an instance of the previous class.
  const kept = scope[KEY] as { backend?: SessionBackend & KeyValue } | undefined;
  // After a hot reload in development the kept store is the old class: rebuild it around
  // the same backend, so the code is new and the sessions are not lost.
  if (!(kept instanceof BridgeStore)) {
    scope[KEY] = new BridgeStore({ backend: kept?.backend ?? backendFromEnv() });
  }
  return scope[KEY]!;
}
