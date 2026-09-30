import type { Callback, Op, Scenario } from '@/core/labs/event-loop-stepper';

type Loose<T> = T extends unknown ? Omit<T, 'line'> & { line?: number } : never;
export type LooseOp = Loose<Op>;

/** A scenario from callback bodies alone. Lines default to 1: most rules ignore them. */
export function program(
  bodies: Record<string, readonly LooseOp[]>,
  extra: Partial<Scenario> = {},
): Scenario {
  const callbacks: Callback[] = Object.entries(bodies).map(([id, ops]) => ({
    id,
    label: id === 'main' ? 'script' : id,
    line: 1,
    ops: ops.map((op) => ({ line: 1, ...op }) as Op),
  }));
  return {
    id: 'test',
    title: 'Test',
    prompt: 'Predict.',
    source: 'line 1\nline 2\nline 3',
    entry: { callback: 'main', label: 'script', source: 'script' },
    callbacks,
    ...extra,
  };
}

export const log = (text: string): LooseOp => ({ kind: 'log', text });
