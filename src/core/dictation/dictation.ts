/*
 * Speaking an explanation instead of typing it: the state of one minute of dictation. The
 * browser's speech recogniser lives in src/features/lesson-player/useDictation.ts; this is
 * what it reports, folded into what the step shows and what a screen reader hears.
 *
 * One minute, because an explain-back aims for 30 to 80 words, which is about a minute of
 * speech. Long enough to make three points, short enough to stay one thought.
 */

export const DICTATION_SECONDS = 60;

/** The last stretch is announced once, not counted down aloud. */
const FINAL_STRETCH = 10;

/** Why listening stopped early, in the few kinds a learner can act on. */
export type DictationError = 'blocked' | 'no-mic' | 'silence' | 'network' | 'other';

export interface DictationState {
  listening: boolean;
  /** When listening began, in ms; null before the first start. */
  startedAt: number | null;
  /** The latest tick, in ms. */
  now: number;
  /** Words heard but not settled yet: shown live, never put in the text. */
  interim: string;
  error: DictationError | null;
}

export type DictationEvent =
  | { type: 'start'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'interim'; text: string }
  /** Words settled: the caller has put them in the text. */
  | { type: 'final' }
  /** The browser's error code, as SpeechRecognitionErrorEvent.error gives it. */
  | { type: 'error'; code: string }
  | { type: 'end' };

export const IDLE: DictationState = {
  listening: false,
  startedAt: null,
  now: 0,
  interim: '',
  error: null,
};

function reason(code: string): DictationError | null {
  switch (code) {
    case 'aborted':
      return null;
    case 'not-allowed':
    case 'service-not-allowed':
      return 'blocked';
    case 'audio-capture':
      return 'no-mic';
    case 'no-speech':
      return 'silence';
    case 'network':
      return 'network';
    default:
      return 'other';
  }
}

export function dictationReducer(state: DictationState, event: DictationEvent): DictationState {
  switch (event.type) {
    case 'start':
      return { listening: true, startedAt: event.at, now: event.at, interim: '', error: null };
    case 'tick':
      return state.listening ? { ...state, now: event.at } : state;
    case 'interim':
      return state.listening ? { ...state, interim: event.text } : state;
    case 'final':
      return { ...state, interim: '' };
    case 'error':
      return { ...state, listening: false, interim: '', error: reason(event.code) };
    case 'end':
      return { ...state, listening: false, interim: '' };
  }
}

export function remainingSeconds(state: DictationState): number {
  if (state.startedAt === null) return DICTATION_SECONDS;
  const elapsed = Math.floor((state.now - state.startedAt) / 1000);
  return Math.max(0, DICTATION_SECONDS - elapsed);
}

const STATUS: Record<DictationError, string> = {
  blocked: 'Microphone blocked. You can type instead.',
  'no-mic': 'No microphone found. You can type instead.',
  silence: 'No speech heard. Try again or type.',
  network: 'Speech needs a connection. You can type instead.',
  other: 'Listening stopped. You can type instead.',
};

/** The short line under the field after an error; null when there is nothing to say. */
export function dictationStatusLine(error: DictationError | null): string | null {
  return error ? STATUS[error] : null;
}

/*
 * What the live region holds. It changes only at the start, once for the last ten seconds
 * and at the stop, so a screen reader hears three sentences in a minute, not sixty numbers.
 */
export function dictationAnnouncement(state: DictationState): string {
  if (state.startedAt === null) return '';
  if (state.error) return STATUS[state.error];
  if (!state.listening) return 'Stopped listening.';
  return remainingSeconds(state) <= FINAL_STRETCH
    ? `${FINAL_STRETCH} seconds left.`
    : 'Listening. You have one minute.';
}

/** Settled speech joined onto what is already written, with one space between. */
export function appendSpeech(text: string, spoken: string): string {
  const words = spoken.trim();
  if (!words) return text;
  const before = text.replace(/[ \t]+$/, '');
  if (!before || before.endsWith('\n')) return `${before}${words}`;
  return `${before} ${words}`;
}
