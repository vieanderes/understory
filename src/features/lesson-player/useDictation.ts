'use client';

import { useCallback, useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import {
  dictationReducer,
  IDLE,
  remainingSeconds,
  type DictationState,
} from '@/core/dictation/dictation';

/*
 * The browser's speech recogniser behind "Say it out loud" on an explain-back
 * (src/core/dictation holds the rules). We store and send no audio: the browser turns speech
 * into text, and some engines do that on their maker's servers (Chrome sends the audio to
 * Google), which the first-use hint says.
 */

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

const noSubscribe = () => () => {};

/** Whether this browser can listen. The server cannot know, so it renders no microphone. */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => recognitionConstructor() !== undefined,
    () => false,
  );
}

// ---- The first-use hint -----------------------------------------------------------------

const HINT_KEY = 'understory:dictation:hint-seen';
let hintSeenInMemory = false;
const hintListeners = new Set<() => void>();

function readHintSeen(): boolean {
  if (hintSeenInMemory) return true;
  try {
    return window.localStorage.getItem(HINT_KEY) === '1';
  } catch {
    return false;
  }
}

function markHintSeen(): void {
  if (readHintSeen()) return;
  hintSeenInMemory = true;
  try {
    window.localStorage.setItem(HINT_KEY, '1');
  } catch {
    // A private window: the hint is seen for this visit.
  }
  hintListeners.forEach((notify) => notify());
}

function useHintSeen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      hintListeners.add(onChange);
      return () => hintListeners.delete(onChange);
    },
    readHintSeen,
    () => true,
  );
}

// ---- The hook ---------------------------------------------------------------------------

export interface Dictation {
  state: DictationState;
  remaining: number;
  /** The one-line privacy hint is due: the learner has not listened before. */
  showHint: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * One minute of listening. Settled words go to onFinal, which appends them to the text;
 * words still being heard are in state.interim. It stops by itself at the minute.
 */
export function useDictation(onFinal: (spoken: string) => void): Dictation {
  const [state, dispatch] = useReducer(dictationReducer, IDLE);
  const recognition = useRef<Recognition | null>(null);
  const finalRef = useRef(onFinal);
  const hintSeen = useHintSeen();

  useEffect(() => {
    finalRef.current = onFinal;
  });

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor || recognition.current) return;
    const rec = new Constructor();
    rec.lang = document.documentElement.lang || 'en-GB';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const words = result?.[0]?.transcript ?? '';
        if (result?.isFinal) {
          finalRef.current(words);
          dispatch({ type: 'final' });
        } else {
          interim += words;
        }
      }
      dispatch({ type: 'interim', text: interim.trim() });
    };
    rec.onerror = (event) => dispatch({ type: 'error', code: event.error });
    rec.onend = () => {
      recognition.current = null;
      dispatch({ type: 'end' });
    };
    recognition.current = rec;
    dispatch({ type: 'start', at: Date.now() });
    try {
      rec.start();
    } catch {
      recognition.current = null;
      dispatch({ type: 'error', code: 'other' });
    }
  }, []);

  // The countdown: a clock, not mirrored state. At the minute it asks the engine to stop,
  // which still delivers the last words before it ends.
  const remaining = remainingSeconds(state);
  useEffect(() => {
    if (!state.listening) return;
    const timer = setInterval(() => dispatch({ type: 'tick', at: Date.now() }), 250);
    return () => clearInterval(timer);
  }, [state.listening]);

  useEffect(() => {
    if (state.listening && remaining === 0) recognition.current?.stop();
  }, [state.listening, remaining]);

  // The hint has been read once listening ends: next time the microphone just listens.
  const listenedBefore = state.startedAt !== null && !state.listening;
  useEffect(() => {
    if (listenedBefore) markHintSeen();
  }, [listenedBefore]);

  // Leaving the step mid-sentence lets the microphone go.
  useEffect(() => () => recognition.current?.abort(), []);

  return { state, remaining, showHint: !hintSeen, start, stop };
}
