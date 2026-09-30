import { vi } from 'vitest';
// Adds DOM matchers such as toHaveAttribute. Harmless in the Node-environment katas.
import '@testing-library/jest-dom/vitest';

// Testing Library waits a zero-length setTimeout after each user event. Under fake timers
// that timeout never fires unless it can find `jest.advanceTimersByTime`, so give it one.
// Without this, any React test that uses vi.useFakeTimers hangs until it times out.
(globalThis as { jest?: unknown }).jest = {
  advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
};
