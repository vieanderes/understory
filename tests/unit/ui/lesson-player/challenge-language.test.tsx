import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CHALLENGE_LANGUAGE_KEY,
  readChallengeLanguage,
  setChallengeLanguage,
  useChallengeLanguage,
} from '@/features/lesson-player/challenge-language';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('useChallengeLanguage', () => {
  it('is null before any choice', () => {
    const { result } = renderHook(() => useChallengeLanguage());
    expect(result.current).toBeNull();
  });

  it('stores a choice and tells every reader in the tab', () => {
    const one = renderHook(() => useChallengeLanguage());
    const two = renderHook(() => useChallengeLanguage());
    act(() => setChallengeLanguage('python'));
    expect(one.result.current).toBe('python');
    expect(two.result.current).toBe('python');
    expect(window.localStorage.getItem(CHALLENGE_LANGUAGE_KEY)).toBe('python');
  });

  it('follows a choice made in another tab', () => {
    const { result } = renderHook(() => useChallengeLanguage());
    act(() => {
      window.localStorage.setItem(CHALLENGE_LANGUAGE_KEY, 'ts');
      window.dispatchEvent(new StorageEvent('storage', { key: CHALLENGE_LANGUAGE_KEY }));
    });
    expect(result.current).toBe('ts');
  });

  it('keeps the choice for the tab when storage refuses it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    const { result } = renderHook(() => useChallengeLanguage());
    act(() => setChallengeLanguage('js'));
    expect(result.current).toBe('js');
    expect(readChallengeLanguage()).toBe('js');
    // Once storage works again, what it holds is the answer.
    vi.restoreAllMocks();
    act(() => setChallengeLanguage('ts'));
    expect(readChallengeLanguage()).toBe('ts');
  });
});
