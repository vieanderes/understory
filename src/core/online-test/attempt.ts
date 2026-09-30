import type { TaskLanguage } from './signature';

/*
 * One sitting of an online test, as a pure reducer. The rules are the platform's
 * (docs/ONLINE-TEST.md, "Flow"):
 *
 *  - the clock starts only after the tour and the "Are you ready to start?" dialog;
 *  - one clock covers every task and never pauses, not even when the candidate quits;
 *  - each task keeps a solution per language, so switching back brings the old one back;
 *  - after the time is up nothing changes any more, and the code as it stands is submitted;
 *  - submitting ends the whole test, once.
 *
 * Integrity signals, code snapshots for the playback and the assistant transcript are
 * recorded here too, because the report shows them as the reviewer would see them.
 */

export type AttemptPhase = 'intro' | 'tour' | 'ready' | 'running' | 'submitted';
export type TestMode = 'demo' | 'screen' | 'ai' | 'mock' | 'training' | 'custom';

export interface TestSpec {
  /** Route key: a preset id, `train-<task>` or `custom`. */
  key: string;
  title: string;
  mode: TestMode;
  minutes: number;
  taskIds: string[];
  languages: TaskLanguage[];
  assistant: boolean;
  proctoring: boolean;
  /** Guided mode: the coach walks each task step by step (docs/ONLINE-TEST.md). */
  guided?: boolean;
}

export interface TaskDraft {
  language: TaskLanguage;
  code: Partial<Record<TaskLanguage, string>>;
  /** The contents of test-input.txt. */
  input: string;
  runs: number;
}

export type IntegrityKind = 'paste' | 'copy-blocked' | 'hidden' | 'visible' | 'blur' | 'focus';

export interface IntegrityEvent {
  at: number;
  kind: IntegrityKind;
  taskId?: string;
  /** Pasted characters. */
  chars?: number;
}

export interface Snapshot {
  at: number;
  taskId: string;
  language: TaskLanguage;
  code: string;
}

export interface AssistantMessage {
  at: number;
  role: 'user' | 'assistant';
  text: string;
  taskId: string;
}

export type SubmitReason = 'candidate' | 'time-up';

export interface AttemptState {
  id: string;
  spec: TestSpec;
  phase: AttemptPhase;
  createdAt: number;
  startedAt?: number;
  activeTask: number;
  drafts: Record<string, TaskDraft>;
  integrity: IntegrityEvent[];
  snapshots: Snapshot[];
  assistant: AssistantMessage[];
  quits: number[];
  submittedAt?: number;
  submitReason?: SubmitReason;
  /** The step the guide shows, per task. */
  guideSteps?: Record<string, number>;
  /** The guide was open at some point: the report says the attempt was guided. */
  guideUsed?: boolean;
}

export type AttemptAction =
  | { type: 'tour-started' }
  | { type: 'tour-finished' }
  | { type: 'started'; at: number }
  | { type: 'task-selected'; index: number }
  | { type: 'language-set'; taskId: string; language: TaskLanguage; starter: string }
  | { type: 'code-edited'; taskId: string; code: string; at: number }
  | { type: 'input-edited'; taskId: string; text: string }
  | { type: 'code-run'; taskId: string; at: number }
  | { type: 'integrity'; event: IntegrityEvent }
  | { type: 'assistant-message'; message: AssistantMessage }
  | { type: 'quit'; at: number }
  | { type: 'submitted'; at: number; reason: SubmitReason }
  | { type: 'guide-opened' }
  | { type: 'guide-step'; taskId: string; index: number };

/** A snapshot at most this often per task while typing, so the playback stays small. */
export const SNAPSHOT_GAP_MS = 10_000;
export const MAX_SNAPSHOTS = 600;

export function createAttempt(
  id: string,
  spec: TestSpec,
  starters: Readonly<Record<string, string>>,
  createdAt: number,
): AttemptState {
  const language = spec.languages[0] ?? 'js';
  const drafts: Record<string, TaskDraft> = {};
  for (const taskId of spec.taskIds) {
    drafts[taskId] = { language, code: { [language]: starters[taskId] ?? '' }, input: '', runs: 0 };
  }
  return {
    id,
    spec,
    phase: 'intro',
    createdAt,
    activeTask: 0,
    drafts,
    integrity: [],
    snapshots: [],
    assistant: [],
    quits: [],
  };
}

export function endsAt(state: AttemptState): number | undefined {
  return state.startedAt === undefined ? undefined : state.startedAt + state.spec.minutes * 60_000;
}

export function isTimeUp(state: AttemptState, now: number): boolean {
  const end = endsAt(state);
  return end !== undefined && now >= end;
}

/** Whole seconds left, rounded up, so 0 means the time really is up. */
export function secondsRemaining(state: AttemptState, now: number): number {
  const end = endsAt(state);
  if (end === undefined) return state.spec.minutes * 60;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** The top bar's "0h 29min": hours and whole minutes, as the platform shows it. */
export function clockLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

function withSnapshot(state: AttemptState, snapshot: Snapshot, force: boolean): Snapshot[] {
  const last = state.snapshots.findLast((s) => s.taskId === snapshot.taskId);
  if (last && last.code === snapshot.code && last.language === snapshot.language)
    return state.snapshots;
  const due =
    force ||
    !last ||
    last.language !== snapshot.language ||
    snapshot.at - last.at >= SNAPSHOT_GAP_MS;
  if (!due) return state.snapshots;
  const next = [...state.snapshots, snapshot];
  return next.length > MAX_SNAPSHOTS ? next.slice(next.length - MAX_SNAPSHOTS) : next;
}

function updateDraft(
  state: AttemptState,
  taskId: string,
  change: (draft: TaskDraft) => TaskDraft,
): AttemptState {
  const draft = state.drafts[taskId];
  if (!draft) return state;
  return { ...state, drafts: { ...state.drafts, [taskId]: change(draft) } };
}

export function codeOf(
  state: AttemptState,
  taskId: string,
): { language: TaskLanguage; code: string } {
  const draft = state.drafts[taskId];
  const language = draft?.language ?? state.spec.languages[0] ?? 'js';
  return { language, code: draft?.code[language] ?? '' };
}

export function reduceAttempt(state: AttemptState, action: AttemptAction): AttemptState {
  switch (action.type) {
    case 'tour-started':
      return state.phase === 'intro' ? { ...state, phase: 'tour' } : state;
    case 'tour-finished':
      return state.phase === 'tour' ? { ...state, phase: 'ready' } : state;
    case 'started':
      return state.phase === 'ready' ? { ...state, phase: 'running', startedAt: action.at } : state;
    case 'submitted':
      return state.phase === 'running'
        ? { ...state, phase: 'submitted', submittedAt: action.at, submitReason: action.reason }
        : state;
    case 'integrity':
      return state.phase === 'running'
        ? { ...state, integrity: [...state.integrity, action.event] }
        : state;
    case 'assistant-message':
      return state.phase === 'running'
        ? { ...state, assistant: [...state.assistant, action.message] }
        : state;
    case 'quit':
      return state.phase === 'running' ? { ...state, quits: [...state.quits, action.at] } : state;
    default:
      break;
  }

  if (state.phase !== 'running') return state;
  switch (action.type) {
    case 'guide-opened':
      return state.guideUsed ? state : { ...state, guideUsed: true };
    case 'guide-step':
      if (action.index < 0) return state;
      return {
        ...state,
        guideUsed: true,
        guideSteps: { ...state.guideSteps, [action.taskId]: action.index },
      };
    case 'task-selected':
      return action.index >= 0 && action.index < state.spec.taskIds.length
        ? { ...state, activeTask: action.index }
        : state;
    case 'language-set':
      if (!state.spec.languages.includes(action.language)) return state;
      return updateDraft(state, action.taskId, (draft) => ({
        ...draft,
        language: action.language,
        code: { ...draft.code, [action.language]: draft.code[action.language] ?? action.starter },
      }));
    case 'code-edited': {
      if (isTimeUp(state, action.at)) return state;
      const draft = state.drafts[action.taskId];
      if (!draft || draft.code[draft.language] === action.code) return state;
      const next = updateDraft(state, action.taskId, (d) => ({
        ...d,
        code: { ...d.code, [d.language]: action.code },
      }));
      return {
        ...next,
        snapshots: withSnapshot(
          state,
          { at: action.at, taskId: action.taskId, language: draft.language, code: action.code },
          false,
        ),
      };
    }
    case 'input-edited':
      return updateDraft(state, action.taskId, (d) => ({ ...d, input: action.text }));
    case 'code-run': {
      const next = updateDraft(state, action.taskId, (d) => ({ ...d, runs: d.runs + 1 }));
      const { language, code } = codeOf(state, action.taskId);
      return {
        ...next,
        snapshots: withSnapshot(
          state,
          { at: action.at, taskId: action.taskId, language, code },
          true,
        ),
      };
    }
    default:
      return state;
  }
}

// ---- Integrity ------------------------------------------------------------------------

export type IntegrityIssue =
  'pasted-code' | 'copy-description' | 'losing-focus' | 'switching-tabs' | 'time-spent';

export const INTEGRITY_ISSUE_LABEL: Record<IntegrityIssue, string> = {
  'pasted-code': 'Pasted code',
  'copy-description': 'Attempt to copy description',
  'losing-focus': 'Losing browser focus',
  'switching-tabs': 'Switching tabs',
  'time-spent': 'Time spent',
};

export interface IntegritySummary {
  pastes: number;
  pastedChars: number;
  largestPaste: number;
  copyAttempts: number;
  tabSwitches: number;
  focusLosses: number;
  /** Time with the tab hidden or the window unfocused, whichever is longer. */
  awayMs: number;
  durationMs: number;
  issues: IntegrityIssue[];
  risk: 'Low' | 'Medium' | 'High';
}

/** A paste this long reads as code brought in from elsewhere, not a moved line. */
export const LARGE_PASTE_CHARS = 120;

function awayTime(
  events: readonly IntegrityEvent[],
  leave: IntegrityKind,
  back: IntegrityKind,
  end: number,
): number {
  let total = 0;
  let since: number | undefined;
  for (const event of events) {
    if (event.kind === leave && since === undefined) since = event.at;
    else if (event.kind === back && since !== undefined) {
      total += event.at - since;
      since = undefined;
    }
  }
  return since === undefined ? total : total + Math.max(0, end - since);
}

export function integritySummary(
  state: AttemptState,
  recommendedMinutes: number,
): IntegritySummary {
  const start = state.startedAt ?? state.createdAt;
  const end = state.submittedAt ?? endsAt(state) ?? start;
  const events = state.integrity;
  const pastes = events.filter((e) => e.kind === 'paste');
  const pastedChars = pastes.reduce((sum, e) => sum + (e.chars ?? 0), 0);
  const largestPaste = pastes.reduce((max, e) => Math.max(max, e.chars ?? 0), 0);
  const copyAttempts = events.filter((e) => e.kind === 'copy-blocked').length;
  const tabSwitches = events.filter((e) => e.kind === 'hidden').length;
  const focusLosses = events.filter((e) => e.kind === 'blur').length;
  const awayMs = Math.max(
    awayTime(events, 'hidden', 'visible', end),
    awayTime(events, 'blur', 'focus', end),
  );
  const durationMs = Math.max(0, end - start);

  const issues: IntegrityIssue[] = [];
  if (largestPaste >= LARGE_PASTE_CHARS) issues.push('pasted-code');
  if (copyAttempts > 0) issues.push('copy-description');
  if (focusLosses > 0) issues.push('losing-focus');
  if (tabSwitches > 0) issues.push('switching-tabs');
  // Finishing in under a fifth of the recommended time is what reviewers are told to look at.
  if (recommendedMinutes > 0 && durationMs < recommendedMinutes * 60_000 * 0.2)
    issues.push('time-spent');

  const risk = issues.length === 0 ? 'Low' : issues.length <= 2 ? 'Medium' : 'High';
  return {
    pastes: pastes.length,
    pastedChars,
    largestPaste,
    copyAttempts,
    tabSwitches,
    focusLosses,
    awayMs,
    durationMs,
    issues,
    risk,
  };
}
