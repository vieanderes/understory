import { describe, expect, it } from 'vitest';
import {
  DICTATION_SECONDS,
  appendSpeech,
  dictationAnnouncement,
  dictationReducer,
  dictationStatusLine,
  IDLE,
  remainingSeconds,
  type DictationState,
} from '@/core/dictation/dictation';

const start = (at = 1000) => dictationReducer(IDLE, { type: 'start', at });

describe('dictationReducer', () => {
  it('starts listening with a full minute and no leftover error', () => {
    const failed: DictationState = { ...IDLE, error: 'blocked' };
    const state = dictationReducer(failed, { type: 'start', at: 5000 });
    expect(state).toMatchObject({ listening: true, startedAt: 5000, now: 5000, interim: '' });
    expect(state.error).toBeNull();
    expect(remainingSeconds(state)).toBe(DICTATION_SECONDS);
  });

  it('counts down whole seconds and never below zero', () => {
    let state = start(0);
    state = dictationReducer(state, { type: 'tick', at: 999 });
    expect(remainingSeconds(state)).toBe(60);
    state = dictationReducer(state, { type: 'tick', at: 1000 });
    expect(remainingSeconds(state)).toBe(59);
    state = dictationReducer(state, { type: 'tick', at: 75_000 });
    expect(remainingSeconds(state)).toBe(0);
  });

  it('ignores ticks and interim text once listening has ended', () => {
    const ended = dictationReducer(start(), { type: 'end' });
    expect(dictationReducer(ended, { type: 'tick', at: 9000 })).toBe(ended);
    expect(dictationReducer(ended, { type: 'interim', text: 'late' })).toBe(ended);
  });

  it('shows interim words, and clears them when they are final or listening ends', () => {
    let state = dictationReducer(start(), { type: 'interim', text: 'the field' });
    expect(state.interim).toBe('the field');
    state = dictationReducer(state, { type: 'final' });
    expect(state.interim).toBe('');
    state = dictationReducer(state, { type: 'interim', text: 'gives' });
    state = dictationReducer(state, { type: 'end' });
    expect(state).toMatchObject({ listening: false, interim: '', error: null });
  });

  it('turns a browser error into one of a few reasons and stops listening', () => {
    const cases = [
      ['not-allowed', 'blocked'],
      ['service-not-allowed', 'blocked'],
      ['audio-capture', 'no-mic'],
      ['no-speech', 'silence'],
      ['network', 'network'],
      ['language-not-supported', 'other'],
    ] as const;
    for (const [code, reason] of cases) {
      const state = dictationReducer(start(), { type: 'error', code });
      expect(state).toMatchObject({ listening: false, error: reason });
    }
  });

  it('treats an abort as a plain stop, not an error', () => {
    expect(dictationReducer(start(), { type: 'error', code: 'aborted' }).error).toBeNull();
  });

  it('keeps the reason when the end follows an error', () => {
    const failed = dictationReducer(start(), { type: 'error', code: 'network' });
    expect(dictationReducer(failed, { type: 'end' }).error).toBe('network');
  });
});

describe('dictationStatusLine', () => {
  it('says what happened in a few words and offers typing', () => {
    expect(dictationStatusLine('blocked')).toBe('Microphone blocked. You can type instead.');
    expect(dictationStatusLine('silence')).toBe('No speech heard. Try again or type.');
    expect(dictationStatusLine(null)).toBeNull();
    for (const reason of ['no-mic', 'network', 'other'] as const) {
      expect(dictationStatusLine(reason)).toMatch(/^[A-Z][^!—]+\.$/);
    }
  });
});

describe('dictationAnnouncement', () => {
  it('speaks at the start, once in the last ten seconds and at the stop, not every second', () => {
    let state = start(0);
    const heard = new Set<string>();
    heard.add(dictationAnnouncement(state));
    for (let at = 1000; at <= 60_000; at += 1000) {
      state = dictationReducer(state, { type: 'tick', at });
      heard.add(dictationAnnouncement(state));
    }
    expect([...heard]).toEqual(['Listening. You have one minute.', '10 seconds left.']);
    expect(dictationAnnouncement(dictationReducer(state, { type: 'end' }))).toBe(
      'Stopped listening.',
    );
  });

  it('is silent before anyone has listened, and reads out an error', () => {
    expect(dictationAnnouncement(IDLE)).toBe('');
    const failed = dictationReducer(start(), { type: 'error', code: 'not-allowed' });
    expect(dictationAnnouncement(failed)).toBe('Microphone blocked. You can type instead.');
  });
});

describe('appendSpeech', () => {
  it('joins spoken words to the text with one space', () => {
    expect(appendSpeech('', ' the field gives a string ')).toBe('the field gives a string');
    expect(appendSpeech('It joins', 'as text')).toBe('It joins as text');
    expect(appendSpeech('It joins ', 'as text')).toBe('It joins as text');
    expect(appendSpeech('Line one\n', 'line two')).toBe('Line one\nline two');
  });

  it('leaves the text alone when nothing was said', () => {
    expect(appendSpeech('Written', '   ')).toBe('Written');
  });
});
