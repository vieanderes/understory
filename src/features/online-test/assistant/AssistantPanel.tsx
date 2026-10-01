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
import { Markdown } from './Markdown';
import {
  keyStore,
  modelStore,
  providerStore,
  readModel,
  readPairing,
  refreshMcpStatus,
  rotatePairing,
  useApiKey,
  useLocalCliAvailability,
  useMcpStatus,
  useModel,
  useOrigin,
  usePairing,
  useProvider,
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
}

const PROVIDER_LABEL: Record<AssistantProviderId, string> = {
  'api-key': 'Your API key',
  'claude-cli': 'Claude Code on this machine',
  mcp: 'Your Claude account',
};

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
function ReplyText({ text }: { text: string }) {
  return <Markdown text={text} />;
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

const PROVIDER_HINT: Record<AssistantProviderId, string> = {
  mcp: 'Connect the Claude app once. Works on web, desktop and phone.',
  'claude-cli': 'Uses the account logged in to Claude Code. Nothing to set up.',
  'api-key': 'An Anthropic key, kept in this browser.',
};

function ProviderChoice({
  provider,
  cliAvailable,
  disabled,
  onChange,
}: {
  provider: AssistantProviderId;
  cliAvailable: boolean;
  disabled: boolean;
  onChange: (id: AssistantProviderId) => void;
}) {
  const name = useId();
  const options: AssistantProviderId[] = cliAvailable
    ? ['mcp', 'claude-cli', 'api-key']
    : ['mcp', 'api-key'];
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-1">
      <legend className="t-label mb-1">Assistant</legend>
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
              checked={provider === id}
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
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{PROVIDER_LABEL[id]}</span>
              <span className="text-muted text-sm text-pretty">{PROVIDER_HINT[id]}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProviderSetup({
  provider,
  status,
  onEdit,
}: {
  provider: AssistantProviderId;
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
  const prompt = `Answer my Understory question, code ${formatted}`;
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
        <p className="text-muted text-sm text-pretty" aria-live="polite">
          {status.allowed
            ? `Claude connected at ${clockTime(status.allowed.at)}. Keep the code to yourself.`
            : 'No Claude app connected yet. Keep the code to yourself; it works only in this tab.'}
        </p>
      </div>
      <ol aria-label="Connect your Claude app" className="flex flex-col gap-3">
        <Step n={1} title={local ? 'Add Understory to Claude Code' : 'Add Understory to Claude'}>
          {local ? (
            <>
              <p className="text-muted text-sm text-pretty">
                Run this once. The Claude web and phone apps need the deployed site, not localhost.
              </p>
              <CopyField value={command} label="Copy command" />
            </>
          ) : (
            <>
              <p className="text-muted text-sm text-pretty">
                In Settings, Connectors, add a custom connector with this URL, and choose No
                sign-in.
              </p>
              <CopyField value={endpoint} label="Copy connector URL" />
              <p className="text-muted text-sm">Or in Claude Code:</p>
              <CopyField value={command} label="Copy command" />
            </>
          )}
        </Step>
        <Step n={2} title="Ask here, then tell Claude">
          <CopyField value={prompt} label="Copy the message for Claude" />
        </Step>
        <Step n={3} title="Allow Claude here">
          <p className="text-muted text-sm text-pretty">
            The first time Claude uses the code, Allow appears in this panel. Only the Claude you
            allow can read this tab.
          </p>
        </Step>
      </ol>
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
}: AssistantPanelProps) {
  const storedProvider = useProvider();
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

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  };

  const waitingOnApp = busy && streaming === '' && provider === 'mcp';

  const connected =
    provider === 'mcp'
      ? 'Claude via MCP'
      : provider === 'claude-cli'
        ? 'Claude on this machine'
        : 'Your API key';

  const empty = transcript.length === 0 && !busy;
  const lastReply = transcript.findLastIndex((message) => message.role === 'assistant');

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
        {empty ? (
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
                  <ReplyText text={message.text} />
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
                  <ReplyText text={streaming} />
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
                      Waiting for your Claude app. Tell it to answer code{' '}
                      {formatPairingCode(pairing.code)}. It gives up after {MCP_TIMEOUT_MS / 60_000}{' '}
                      minutes.
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
          className="scout-view min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-1 pb-3"
        >
          <div className="bg-surface sticky top-0 z-10 -mr-1 flex h-5 items-center justify-between gap-1">
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
              provider={provider}
              cliAvailable={cli === 'available'}
              disabled={busy}
              onChange={(id) => {
                providerStore.set(id);
                setError(null);
              }}
            />
            <ProviderSetup
              provider={provider}
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
                className={cn('size-1 shrink-0 rounded-full', ready ? 'bg-success' : 'bg-warning')}
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
