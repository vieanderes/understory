import { describe, expect, it, vi } from 'vitest';
import type { Transpiler } from '@/core/ports/code-runner';
import { createReactKitStore } from '@/features/playground/react-kit';

const transpiler: Transpiler = { strip: (src) => src };

describe('the React kit store', () => {
  it('loads React and the transpiler once, however many playgrounds ask', async () => {
    const runtime = vi.fn(() => Promise.resolve('react'));
    const store = createReactKitStore({ runtime, transpiler: () => Promise.resolve(transpiler) });
    const seen: string[] = [];
    store.subscribe(() => seen.push(store.getSnapshot().status));
    expect(store.getSnapshot()).toEqual({ status: 'idle' });
    store.load();
    store.load();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    store.load();
    expect(runtime).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['loading', 'ready']);
    expect(store.getSnapshot()).toEqual({ status: 'ready', kit: { runtime: 'react', transpiler } });
  });

  it('fails when either part fails, and tries again when asked', async () => {
    let offline = true;
    const store = createReactKitStore({
      runtime: () => (offline ? Promise.reject(new Error('offline')) : Promise.resolve('react')),
      transpiler: () => Promise.resolve(transpiler),
    });
    store.load();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('failed'));
    offline = false;
    store.load();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
  });

  it('stops telling a listener that has unsubscribed', async () => {
    const store = createReactKitStore({
      runtime: () => Promise.resolve('react'),
      transpiler: () => Promise.resolve(transpiler),
    });
    const listener = vi.fn();
    store.subscribe(listener)();
    store.load();
    await vi.waitFor(() => expect(store.getSnapshot().status).toBe('ready'));
    expect(listener).not.toHaveBeenCalled();
  });
});
