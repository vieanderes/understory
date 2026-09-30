import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from '@/features/pwa/useOnlineStatus';

/** `navigator.onLine` is read through an external store, so no effect mirrors it. */

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

afterEach(() => {
  Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
});

describe('useOnlineStatus', () => {
  it('starts from what the browser says', () => {
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
    expect(renderHook(() => useOnlineStatus()).result.current).toBe(false);
  });

  it('follows the offline and online events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
    setOnline(false);
    expect(result.current).toBe(false);
    setOnline(true);
    expect(result.current).toBe(true);
  });

  it('stops listening when the component goes', () => {
    const { result, unmount } = renderHook(() => useOnlineStatus());
    unmount();
    setOnline(false);
    expect(result.current).toBe(true);
  });
});
