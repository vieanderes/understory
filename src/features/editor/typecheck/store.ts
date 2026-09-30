import type { TypeDiagnostic } from '@/core/ports/type-checker';

/*
 * What the list under the editor shows, read with useSyncExternalStore. The CodeMirror
 * extension writes it: the status when a check comes back, the errors whenever the
 * editor's own copy changes (it maps their positions through every edit, so the line
 * numbers here always match the text on screen).
 */

export type TypecheckStatus = 'loading' | 'ready' | 'unavailable';

export interface TypecheckSnapshot {
  status: TypecheckStatus;
  diagnostics: readonly TypeDiagnostic[];
}

export interface TypecheckStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TypecheckSnapshot;
  setStatus(status: TypecheckStatus): void;
  setDiagnostics(diagnostics: readonly TypeDiagnostic[]): void;
}

function same(a: readonly TypeDiagnostic[], b: readonly TypeDiagnostic[]): boolean {
  return (
    a.length === b.length &&
    a.every((d, i) => {
      const e = b[i];
      return (
        e !== undefined &&
        d.from === e.from &&
        d.to === e.to &&
        d.line === e.line &&
        d.message === e.message
      );
    })
  );
}

export function createTypecheckStore(): TypecheckStore {
  let snapshot: TypecheckSnapshot = { status: 'loading', diagnostics: [] };
  const listeners = new Set<() => void>();
  const publish = (next: TypecheckSnapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    setStatus(status) {
      if (status !== snapshot.status) publish({ ...snapshot, status });
    },
    setDiagnostics(diagnostics) {
      if (!same(diagnostics, snapshot.diagnostics)) publish({ ...snapshot, diagnostics });
    },
  };
}
