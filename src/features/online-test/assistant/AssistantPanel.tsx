'use client';

import {
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  CornerDownRight,
  RefreshCw,
  Square,
  TriangleAlert,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  AssistantError,
  type AssistantContext,
  type AssistantPort,
  type AssistantProviderId,
} from '@/core/ports/assistant';
import {
  ASSISTANT_MODELS,
  createAssistantPort,
  decideMcpConnection,
  formatPairingCode,
  MCP_TIMEOUT_MS,
  pushMcpContext,
  type AssistantModel,
  type McpStatus,
} from '@/adapters/assistant';
import { cn } from '@/lib/cn';
import { useAssistantDraft } from '../assistant-draft';
import { clockTime, ConnectionRequest, SafetyNote } from './ConnectionSafety';
import { Markdown, type InAppLinks } from './Markdown';
import {
  keyStore,
  modelStore,
  providerStore,
  readModel,
  readPairing,
  refreshMcpStatus,
  rotatePairing,
  claudeClientStore,
  useApiKey,
  useClaudeClient,
  useLocalCliAvailability,
  useMcpStatus,
  useModel,
  useOrigin,
  usePairing,
  useProvider,
  type ClaudeClient,
} from './prefs';

/*
 * The simulator's assistant, like an assessment's built-in AI assistant (docs/ONLINE-TEST.md, section 6).
 * The parent owns the transcript: the question goes to onMessage at once, the reply when
 * it is finished (or stopped), so the report shows exactly what the candidate saw.
 */

export interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

export interface AssistantPanelProps {
  context: AssistantContext;
  transcript: AssistantMessage[];
  onMessage: (message: AssistantMessage) => void;
  createPort?: (id: AssistantProviderId) => AssistantPort;
  /** The line shown before the first message. Tests say the reviewer reads it; the tutor does not. */
  intro?: string;
  placeholder?: string;
  /** One-tap starters for an empty conversation. */
  suggestions?: readonly string[];
  /** The empty state's question, above the intro. */
  greeting?: string;
  /** Shown beside "Thinking" while a reply is on its way: the tutor's cairn builds itself. */
  thinkingMark?: ReactNode;
  /** Focus the question box on open: the panel was opened to ask something. */
  autoFocus?: boolean;
  /**
   * Lets replies link to pages of the app, for Scout's directions. Left out in a test, where
   * a link away would leave the timed task.
   */
  inAppLinks?: InAppLinks;
  /**
   * Draws a reply instead of plain Markdown: Scout's planner turns the blocks in its replies
   * into choices and a draft path. The default is the Markdown alone.
   */
  renderReply?: (text: string, reply: ReplyState) => ReactNode;
  /** Replaces the greeting and the starters of an empty conversation. */
  renderEmpty?: (actions: PanelActions) => ReactNode;
  /**
   * A question the page asked for the learner (Scout's askTutor). It is sent as soon as a
   * provider is ready, or put in the question box while the learner sets one up.
   */
  queued?: string | null;
  /** Hands the queued question over once, so it is never asked twice. */
  takeQueued?: () => string | null;
}

/** What a custom reply or empty state can do: ask, or put the learner in the question box. */
export interface PanelActions {
  send: (text: string) => void;
  focusComposer: () => void;
  /** A provider is connected and nothing is on its way: a question can go now. */
  canSend: boolean;
}

export interface ReplyState extends PanelActions {
  /** The newest reply: the only one whose choices still apply. */
  latest: boolean;
  streaming: boolean;
  /** What the learner said after this reply, if anything. */
  answer?: string;
  links?: InAppLinks;
}

const MODEL_LABEL: Record<AssistantModel, string> = {
  'claude-sonnet-5-5': 'Sonnet 5.5',
  'claude-opus-5-5': 'Opus 5.5',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
};

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
const FIELD = cn(
  'border-border bg-surface text-fg rounded-control w-full border px-1 text-sm',
  'placeholder:text-faint hover:border-border-strong',
  FOCUS,
);

function defaultCreatePort(id: AssistantProviderId): AssistantPort {
  return createAssistantPort(id, {
    getKey: keyStore.get,
    pairing: readPairing(),
    model: readModel,
  });
}

/** Message times, read in event handlers only. */
const timestamp = (): number => Date.now();

function errorText(error: unknown): string {
  if (error instanceof AssistantError) return error.message;
  return 'The assistant failed to answer. Ask again.';
}

/** Replies are Markdown: code blocks highlighted, lists and emphasis kept (Markdown.tsx). */
/**
 * Calls a parent's renderer as a component, so its actions arrive as props, like any
 * event handler, rather than as values read while the panel renders.
 */
function Drawn<A>({ draw, arg }: { draw: (arg: A) => ReactNode; arg: A }) {
  return draw(arg);
}

function ReplyText({ text, links }: { text: string; links?: InAppLinks }) {
  return <Markdown text={text} {...(links ? { links } : {})} />;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the text is on screen to select by hand.
    }
  };
  const Icon = copied ? Check : Copy;
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={label}
      className={cn(
        'text-muted hover:text-fg hover:bg-raised rounded-control inline-flex size-5 shrink-0 items-center justify-center',
        'transition-press active:scale-98',
        FOCUS,
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={2} />
    </button>
  );
}

/** A value to paste somewhere else: shown in full, one tap to copy. */
function CopyField({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-border bg-sunken rounded-control flex items-start gap-0.5 border py-0.5 pr-0.5 pl-1">
      <code className="min-w-0 flex-1 py-1 font-mono text-sm wrap-break-word select-all">
        {value}
      </code>
      <CopyButton value={value} label={label} />
    </div>
  );
}

/** One numbered step of connecting the Claude app: the order is the instruction. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-1">
      <span
        aria-hidden
        className="border-border-strong t-figure text-muted inline-flex size-3 shrink-0 items-center justify-center rounded-full border text-sm"
      >
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex min-h-3 items-center text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * The ways to reach Claude, as the learner thinks of them: where they use Claude. The Claude
 * app and Claude Code share one connection (MCP) and differ only in how it is set up.
 */
type Choice = ClaudeClient | 'claude-cli' | 'api-key';

const CHOICES: Record<Choice, { label: string; hint: string }> = {
  app: { label: 'Claude app', hint: 'Web, desktop or phone. Connect once, then just ask here.' },
  code: {
    label: 'Claude Code',
    hint: 'Works now with one command. A plugin that needs even less is coming.',
  },
  'claude-cli': {
    label: 'Claude Code on this machine',
    hint: 'Already signed in on this computer. Nothing to set up.',
  },
  'api-key': { label: 'An API key', hint: 'No Claude plan? Pay per question with your own key.' },
};

function ProviderChoice({
  choice,
  cliAvailable,
  disabled,
  onChange,
}: {
  choice: Choice;
  cliAvailable: boolean;
  disabled: boolean;
  onChange: (choice: Choice) => void;
}) {
  const name = useId();
  // Where nothing needs setting up, that comes first and is the one to pick.
  const options: Choice[] = cliAvailable
    ? ['claude-cli', 'app', 'code', 'api-key']
    : ['app', 'code', 'api-key'];
  const recommended = options[0];
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-1">
      <legend className="t-label mb-1">Where do you use Claude?</legend>
      <div className="border-border rounded-panel divide-border flex flex-col divide-y border">
        {options.map((id) => (
          <label
            key={id}
            className={cn(
              'group first:rounded-t-panel last:rounded-b-panel flex cursor-pointer items-start gap-1 p-1.5',
              'transition-press hover:bg-raised has-checked:bg-raised',
              'has-focus-visible:outline-accent has-focus-visible:relative has-focus-visible:outline-2 has-focus-visible:-outline-offset-2',
              'has-disabled:cursor-default has-disabled:opacity-60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={id}
              checked={choice === id}
              onChange={() => onChange(id)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'border-border-strong mt-0.5 inline-flex size-2 shrink-0 items-center justify-center rounded-full border',
                'transition-press peer-checked:border-fg',
              )}
            >
              <span className="bg-fg transition-press size-1 scale-0 rounded-full group-has-checked:scale-100" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex items-baseline justify-between gap-1">
                <span className="text-sm font-medium">{CHOICES[id].label}</span>
                {id === recommended ? (
                  <span className="text-muted shrink-0 text-sm">Recommended</span>
                ) : null}
              </span>
              <span className="text-muted text-sm text-pretty">{CHOICES[id].hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The message that starts a listening Claude, the same in every Claude app. */
export const listenMessage = (code: string) =>
  `Keep answering my Understory questions, code ${code}`;

/**
 * The Claude Code plugin (integrations/claude-code) works, but during the channels research
 * preview Claude Code runs only channels on Anthropic's allowlist without a warning meant
 * for developers. Until Understory's is on it, Scout says so and sets Claude Code up the way
 * that works today. When it is approved, this note gives way to the plugin's steps.
 */
function PluginNotReady() {
  return (
    <section
      aria-labelledby="plugin-not-ready"
      className="border-border rounded-panel flex flex-col gap-0.5 border p-1.5"
    >
      <h4 id="plugin-not-ready" className="flex items-center gap-1 text-sm font-medium">
        <TriangleAlert aria-hidden size={16} strokeWidth={2} className="text-warning shrink-0" />
        The Claude Code plugin is not ready yet
      </h4>
      <p className="text-muted text-sm text-pretty">
        With the plugin, your questions would reach Claude Code by themselves. Claude Code only runs
        plugins like it once Anthropic has approved them, and Understory&rsquo;s is still waiting.
        Until then, connect Claude Code this way. Scout will say when the plugin is ready.
      </p>
    </section>
  );
}

function ProviderSetup({
  provider,
  client,
  status,
  onEdit,
}: {
  provider: AssistantProviderId;
  client: ClaudeClient;
  /** The Claude app's connection, for MCP. */
  status: McpStatus;
  /** Typing a key makes the provider ready; the setup stays open until closed. */
  onEdit: () => void;
}) {
  const keyId = useId();
  const modelId = useId();
  const apiKey = useApiKey();
  const model = useModel();
  const origin = useOrigin();
  const { code: pairing } = usePairing();

  const modelField =
    provider === 'mcp' ? null : (
      <div>
        <label htmlFor={modelId} className="t-label">
          Model
        </label>
        <select
          id={modelId}
          value={model}
          onChange={(event) => modelStore.set(event.target.value)}
          className={cn(FIELD, 'mt-0.5 h-5')}
        >
          {ASSISTANT_MODELS.map((id) => (
            <option key={id} value={id}>
              {MODEL_LABEL[id]}
            </option>
          ))}
        </select>
      </div>
    );

  if (provider === 'api-key') {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <label htmlFor={keyId} className="t-label">
            Anthropic API key
          </label>
          <input
            id={keyId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            placeholder="sk-ant-..."
            onChange={(event) => {
              onEdit();
              keyStore.set(event.target.value.trim());
            }}
            className={cn(FIELD, 'mt-0.5 h-5 font-mono')}
          />
          <p className="text-muted mt-0.5 text-sm text-pretty">
            Sent only to this app, which passes it to Anthropic and never stores it.
          </p>
        </div>
        {modelField}
      </div>
    );
  }

  if (provider === 'claude-cli') return modelField;

  if (status.unavailable) {
    return (
      <section className="flex flex-col gap-1">
        <h4 className="flex items-center gap-1 text-base font-semibold">
          <TriangleAlert aria-hidden size={16} strokeWidth={2} className="text-warning shrink-0" />
          Not available on this site
        </h4>
        <p className="text-muted text-sm text-pretty">
          This site’s server has no shared store, so Claude cannot reach this tab. Choose another
          assistant above.
        </p>
        <p className="text-muted text-sm text-pretty">
          Run this site? Connect a Redis store to the deployment and redeploy. The deployment guide
          has the steps.
        </p>
      </section>
    );
  }

  const endpoint = `${origin}/api/mcp`;
  const command = `claude mcp add --transport http understory ${endpoint}`;
  // claude.ai reaches connectors from its own servers, so a localhost URL only works for
  // Claude Code and Claude Desktop's local connections, not for the web or phone apps.
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(origin);
  const formatted = pairing ? formatPairingCode(pairing) : '';
  const state = status.listening
    ? 'Claude is listening. Ask here, and the answer comes back by itself.'
    : status.allowed
      ? `Claude connected at ${clockTime(status.allowed.at)}, but is not listening now. Send it the message again.`
      : 'Not connected yet. It takes a minute, once.';
  const allowStep = (n: number) => (
    <Step n={n} title="Press Allow here">
      <p className="text-muted text-sm text-pretty">
        Allow appears in this panel when Claude first uses the code. Only the Claude you allow can
        read this tab.
      </p>
    </Step>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="bg-raised rounded-panel shadow-edge flex items-center gap-0.5 py-1 pr-1 pl-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="t-label">Pairing code</p>
            <p className="font-mono text-lg font-semibold">{formatted}</p>
          </div>
          <CopyButton value={formatted} label="Copy pairing code" />
          <button
            type="button"
            onClick={rotatePairing}
            aria-label="New code"
            title="New code: the old one stops working"
            className={cn(
              'text-muted hover:text-fg hover:bg-sunken rounded-control inline-flex size-5 shrink-0 items-center justify-center',
              'transition-press active:scale-98',
              FOCUS,
            )}
          >
            <RefreshCw aria-hidden size={16} strokeWidth={2} />
          </button>
        </div>
        <p className="text-muted flex items-start gap-1 text-sm text-pretty" aria-live="polite">
          <span
            aria-hidden
            className={cn(
              'mt-1 size-1 shrink-0 rounded-full',
              status.listening ? 'bg-success' : 'bg-faint',
            )}
          />
          <span>{state} The code works only in this tab; keep it to yourself.</span>
        </p>
      </div>
      {client === 'code' ? (
        <>
          <PluginNotReady />
          <ol aria-label="Connect Claude Code" className="flex flex-col gap-3">
            <Step n={1} title="Add Understory to Claude Code, once">
              <CopyField value={command} label="Copy command" />
            </Step>
            <Step n={2} title="Send Claude this">
              <CopyField value={listenMessage(formatted)} label="Copy the message for Claude" />
              <p className="text-muted text-sm text-pretty">
                Claude then waits for your questions. Keep that session open and ask here.
              </p>
            </Step>
            {allowStep(3)}
          </ol>
        </>
      ) : (
        <ol aria-label="Connect your Claude app" className="flex flex-col gap-3">
          <Step n={1} title="Add Understory to Claude, once">
            {local ? (
              <>
                <p className="text-muted text-sm text-pretty">
                  This copy runs on your computer, which the Claude web and phone apps cannot reach.
                  Add it to Claude Code or Claude Desktop:
                </p>
                <CopyField value={command} label="Copy command" />
              </>
            ) : (
              <>
                <p className="text-muted text-sm text-pretty">
                  In Claude, open Settings, then Connectors, and add a custom connector with this
                  address. Choose No sign-in.
                </p>
                <CopyField value={endpoint} label="Copy connector URL" />
              </>
            )}
          </Step>
          <Step n={2} title="Send Claude this">
            <CopyField value={listenMessage(formatted)} label="Copy the message for Claude" />
            <p className="text-muted text-sm text-pretty">
              Claude then waits for your questions. Keep that chat open and ask here.
            </p>
          </Step>
          {allowStep(3)}
        </ol>
      )}
      <SafetyNote />
    </div>
  );
}

export function AssistantPanel({
  context,
  transcript,
  onMessage,
  createPort,
  intro = 'Ask about the task, the language or your code. The reviewer reads this conversation.',
  placeholder = 'Ask the assistant',
  suggestions = [],
  greeting = 'How can I help with this task?',
  thinkingMark,
  autoFocus = false,
  inAppLinks,
  renderReply,
  renderEmpty,
  queued = null,
  takeQueued,
}: AssistantPanelProps) {
  const storedProvider = useProvider();
  const client = useClaudeClient();
  const cli = useLocalCliAvailability();
  const apiKey = useApiKey();
  const pairing = usePairing();
  // A remembered local provider falls back while it is unavailable (another machine).
  const provider: AssistantProviderId =
    storedProvider === 'claude-cli' && cli !== 'available' ? 'mcp' : storedProvider;

  const [draft, setDraft] = useAssistantDraft();
  const [streaming, setStreaming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupChoice, setSetupChoice] = useState<boolean | null>(null);
  const controller = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const draftId = useId();
  const setupId = useId();
  const hintId = useId();

  const mcpStatus = useMcpStatus(provider === 'mcp' && !createPort);
  const ready =
    provider === 'api-key' ? apiKey.length > 0 : !(provider === 'mcp' && mcpStatus.unavailable);
  // Open by itself until the provider is ready; after that the candidate decides.
  const setupOpen = setupChoice ?? !ready;
  const busy = streaming !== null;

  // A new code makes a new port, so questions go to the new session.
  const port = useMemo(
    () => (createPort ?? defaultCreatePort)(provider),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pairing is read inside defaultCreatePort
    [createPort, provider, pairing],
  );
  const decide = async (allow: boolean) => {
    const request = mcpStatus.request;
    if (!request) return;
    await decideMcpConnection(pairing, request.id, allow);
    refreshMcpStatus();
  };

  // The connected app reads the code through the bridge; keep it current between
  // questions. This syncs an external system, it sets no React state.
  useEffect(() => {
    if (provider !== 'mcp' || !pairing.code || createPort) return;
    const timer = setTimeout(() => void pushMcpContext(pairing, context), 1000);
    return () => clearTimeout(timer);
  }, [provider, pairing, context, createPort]);

  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [transcript.length, streaming]);

  useEffect(() => () => controller.current?.abort(), []);

  const send = async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || busy) return;
    const question: AssistantMessage = { role: 'user', text, at: timestamp() };
    onMessage(question);
    setDraft('');
    setError(null);
    setStreaming('');

    const abort = new AbortController();
    controller.current = abort;
    const turns = [...transcript, question].map(({ role, text: body }) => ({ role, text: body }));
    let reply = '';
    try {
      for await (const chunk of port.send({ turns, context }, abort.signal)) {
        reply += chunk;
        setStreaming(reply);
      }
    } catch (caught) {
      if (!abort.signal.aborted) setError(errorText(caught));
    } finally {
      if (reply.trim()) onMessage({ role: 'assistant', text: reply, at: timestamp() });
      if (controller.current === abort) controller.current = null;
      setStreaming(null);
    }
  };

  const stop = () => controller.current?.abort();

  // A question asked from the page goes out as the panel's first act. Without a provider
  // it waits in the question box, so it is there when setup is done. Taken on the next
  // task, like any subscription callback, so a remount in development asks it once.
  useEffect(() => {
    if (!queued || busy || !takeQueued) return;
    const timer = setTimeout(() => {
      const question = takeQueued();
      if (!question) return;
      if (ready) void send(question);
      else setDraft(question);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send reads the latest transcript; it is not a trigger
  }, [queued, busy, ready, takeQueued]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const waitingOnApp = busy && streaming === '' && provider === 'mcp';

  const connected =
    provider === 'mcp'
      ? mcpStatus.listening
        ? 'Claude is listening'
        : CHOICES[client].label
      : provider === 'claude-cli'
        ? 'Claude on this machine'
        : 'Your API key';
  // For a Claude app, green means it is listening: a question gets an answer by itself.
  const live = provider === 'mcp' ? mcpStatus.listening : ready;

  const empty = transcript.length === 0 && !busy;
  const lastReply = transcript.findLastIndex((message) => message.role === 'assistant');

  const actions: PanelActions = {
    send: (text) => void send(text),
    focusComposer: () => document.getElementById(draftId)?.focus(),
    canSend: ready && !busy,
  };
  const drawReply = (text: string, index: number | null) => {
    const links = inAppLinks ? { links: inAppLinks } : {};
    if (!renderReply) return <ReplyText text={text} {...links} />;
    const next = index === null ? undefined : transcript[index + 1];
    const reply: ReplyState = {
      ...actions,
      ...links,
      latest: index === null || (index === lastReply && !busy),
      streaming: index === null,
      ...(next?.role === 'user' ? { answer: next.text } : {}),
    };
    return <Drawn draw={(state: ReplyState) => renderReply(text, state)} arg={reply} />;
  };

  return (
    <section aria-label="Assistant" className="bg-surface flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        hidden={setupOpen}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-3"
        role="log"
        aria-label="Conversation"
        tabIndex={0}
      >
        {empty && renderEmpty ? <Drawn draw={renderEmpty} arg={actions} /> : null}
        {empty && !renderEmpty ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="text-lg font-semibold tracking-tight text-balance">{greeting}</p>
              <p className="text-muted text-sm text-pretty">{intro}</p>
            </div>
            {suggestions.length > 0 ? (
              <ul aria-label="Suggestions" className="-mx-1 flex flex-col">
                {suggestions.map((suggestion, index) => (
                  <li
                    key={suggestion}
                    className="stream-in"
                    style={{ '--i': index } as CSSProperties}
                  >
                    <button
                      type="button"
                      disabled={!ready}
                      onClick={() => void send(suggestion)}
                      className={cn(
                        'group text-muted hover:text-fg hover:bg-raised rounded-control flex min-h-5 w-full items-center gap-1 px-1 text-left text-sm',
                        'transition-press disabled:text-faint active:scale-98',
                        FOCUS,
                      )}
                    >
                      <CornerDownRight
                        aria-hidden
                        size={16}
                        strokeWidth={2}
                        className="text-faint group-hover:text-fg transition-press shrink-0"
                      />
                      <span className="min-w-0 flex-1">{suggestion}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <ol className="flex flex-col gap-3">
          {transcript.map((message, index) =>
            message.role === 'user' ? (
              <li key={`${index}-${message.at}`} className="flex justify-end pl-4">
                <p className="sr-only">You</p>
                <div className="bg-raised rounded-panel px-1.5 py-1 text-sm break-words whitespace-pre-wrap">
                  {message.text}
                </div>
              </li>
            ) : (
              <li key={`${index}-${message.at}`} className="group/reply flex flex-col gap-0.5">
                <div className="min-w-0 break-words">
                  <p className="sr-only">Assistant</p>
                  {drawReply(message.text, index)}
                </div>
                <div
                  className={cn(
                    '-ml-1 flex',
                    // The latest answer keeps its action in view; older ones show it on hover.
                    index === lastReply
                      ? null
                      : 'transition-press pointer-fine:opacity-0 pointer-fine:group-hover/reply:opacity-100 pointer-fine:focus-within:opacity-100',
                  )}
                >
                  <CopyButton value={message.text} label="Copy the answer" />
                </div>
              </li>
            ),
          )}
          {busy ? (
            <li className="flex flex-col gap-1">
              {streaming ? (
                <div className="min-w-0 break-words" aria-live="polite" aria-busy="true">
                  {drawReply(streaming, null)}
                </div>
              ) : (
                <div
                  className="text-muted flex flex-col gap-0.5 text-sm"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <span className="flex items-center gap-1">
                    {thinkingMark ?? <Thinking />}
                    <span>Thinking…</span>
                    <Elapsed />
                  </span>
                  {waitingOnApp ? (
                    <span className="text-faint text-pretty">
                      {mcpStatus.listening
                        ? 'Claude has the question.'
                        : `Waiting for Claude. If it is not listening yet, send it: ${listenMessage(formatPairingCode(pairing.code))}.`}{' '}
                      It gives up after {MCP_TIMEOUT_MS / 60_000} minutes.
                    </span>
                  ) : null}
                </div>
              )}
            </li>
          ) : null}
        </ol>
      </div>

      {setupOpen ? (
        // The connection is a view of its own that scrolls, not a block stacked on the
        // conversation: on a phone that pushed the question box out of the sheet.
        <div
          id={setupId}
          role="group"
          aria-labelledby={`${setupId}-title`}
          className="scout-view min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
        >
          {/* The top padding lives on the sticky bar, not the scroller: padding above a
              sticky bar is a strip the scrolled content shows through. */}
          <div className="bg-surface sticky top-0 z-10 -mr-1 box-content flex h-5 items-center justify-between gap-1 pt-1">
            <h3 id={`${setupId}-title`} className="text-base font-semibold">
              Connection
            </h3>
            <button
              type="button"
              onClick={() => setSetupChoice(false)}
              className={cn(
                'text-fg hover:bg-raised rounded-control inline-flex h-5 items-center px-1 text-sm font-medium',
                'transition-press active:scale-98',
                FOCUS,
              )}
            >
              Done
            </button>
          </div>
          <div className="mt-2 flex flex-col gap-3">
            <ProviderChoice
              choice={provider === 'mcp' ? client : provider}
              cliAvailable={cli === 'available'}
              disabled={busy}
              onChange={(choice) => {
                if (choice === 'app' || choice === 'code') {
                  claudeClientStore.set(choice);
                  providerStore.set('mcp');
                } else {
                  providerStore.set(choice);
                }
                setError(null);
              }}
            />
            <ProviderSetup
              provider={provider}
              client={client}
              status={mcpStatus}
              onEdit={() => setSetupChoice((choice) => choice ?? true)}
            />
          </div>
        </div>
      ) : null}

      {mcpStatus.request ? (
        <ConnectionRequest
          code={pairing.code}
          at={mcpStatus.request.at}
          onDecide={(allow) => void decide(allow)}
        />
      ) : null}

      {error ? (
        <p role="alert" className="text-danger px-2 pb-1 text-sm">
          {error}
        </p>
      ) : null}

      <form
        className="shrink-0 p-1"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <div
          className={cn(
            'border-border bg-raised rounded-panel flex flex-col border transition-colors',
            'focus-within:border-border-strong focus-within:bg-surface',
          )}
        >
          <label htmlFor={draftId} className="sr-only">
            Ask the assistant
          </label>
          <textarea
            id={draftId}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={placeholder}
            aria-describedby={hintId}
            autoComplete="off"
            autoFocus={autoFocus}
            className="placeholder:text-faint field-sizing-content max-h-30 min-h-6 w-full resize-none bg-transparent px-1.5 pt-1.5 pb-0.5 text-sm outline-none"
          />
          <p id={hintId} className="sr-only">
            Enter sends, Shift and Enter starts a new line.
          </p>
          <div className="flex items-center justify-between gap-1 p-0.5 pl-1">
            <button
              type="button"
              aria-expanded={setupOpen}
              aria-controls={setupId}
              aria-label={`Connection: ${connected}. Assistant settings`}
              title="Assistant settings"
              onClick={() => setSetupChoice(!setupOpen)}
              className={cn(
                'rounded-control inline-flex h-4 min-w-0 items-center gap-0.5 px-0.5 text-sm',
                'transition-press active:scale-98',
                setupOpen ? 'text-fg bg-sunken' : 'text-muted hover:text-fg hover:bg-sunken',
                FOCUS,
              )}
            >
              <span
                aria-hidden
                className={cn('size-1 shrink-0 rounded-full', live ? 'bg-success' : 'bg-warning')}
              />
              <span className="truncate">{connected}</span>
              <ChevronDown
                aria-hidden
                size={16}
                strokeWidth={2}
                className={cn('transition-press shrink-0', setupOpen && 'rotate-180')}
              />
            </button>
            {busy ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop"
                title="Stop"
                className={cn(
                  'bg-fg text-bg rounded-control inline-flex size-4 shrink-0 items-center justify-center',
                  'transition-press active:scale-95',
                  FOCUS,
                )}
              >
                <Square aria-hidden size={12} strokeWidth={2.5} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send"
                title="Send (Enter)"
                disabled={!draft.trim() || !ready}
                className={cn(
                  'bg-accent text-accent-fg hover:bg-accent-hover rounded-control inline-flex size-4 shrink-0 items-center justify-center',
                  'transition-press disabled:text-faint active:scale-95 disabled:bg-transparent',
                  FOCUS,
                )}
              >
                <ArrowUp aria-hidden size={16} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

/** The default thinking mark, for the simulator: one dot, breathing. */
function Thinking() {
  return <span aria-hidden className="bg-muted size-1 shrink-0 animate-pulse rounded-full" />;
}

/*
 * Seconds since the question, read from a shared one-second clock rather than a timer in
 * state, so a reply that takes a while visibly counts instead of looking stuck.
 */
let clockTimer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();
function subscribeClock(onChange: () => void): () => void {
  clockListeners.add(onChange);
  clockTimer ??= setInterval(() => clockListeners.forEach((notify) => notify()), 1000);
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}
const readClock = () => Math.floor(Date.now() / 1000);

function Elapsed() {
  const [start] = useState(readClock);
  const now = useSyncExternalStore(subscribeClock, readClock, () => start);
  const seconds = Math.max(0, now - start);
  return <span className="t-figure text-faint font-mono">{seconds}s</span>;
}
