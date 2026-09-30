import { forEachDiagnostic, linter, setDiagnosticsEffect, type Diagnostic } from '@codemirror/lint';
import { StateField, type EditorState, type Extension } from '@codemirror/state';
import { EditorView, showTooltip, tooltips, type Tooltip } from '@codemirror/view';
import type { TypeChecker, TypeDiagnostic } from '@/core/ports/type-checker';
import type { TypecheckStore } from './store';

/*
 * Live type checking in the editor: a red wavy underline under each error, and the
 * compiler's message in a tooltip. The tooltip opens on hover, as in any editor, and also
 * when the caret sits in an error, which is what a keyboard user and a tap on a phone
 * produce. The list under the editor (TypecheckLayer.tsx) carries the same messages for
 * screen readers.
 */

/** Long enough not to check half-typed words, short enough to feel live. */
const CHECK_DELAY_MS = 400;

function caretIn(state: EditorState, from: number, to: number): boolean {
  const { main } = state.selection;
  return main.empty && main.head >= from && main.head <= to;
}

/** The errors in the editor's state, where they are now. */
function currentDiagnostics(state: EditorState): TypeDiagnostic[] {
  const found: TypeDiagnostic[] = [];
  forEachDiagnostic(state, (d, from, to) => {
    const line = state.doc.lineAt(from);
    const code = Number(/cm-ts-(\d+)/.exec(d.markClass ?? '')?.[1] ?? 0);
    found.push({
      from,
      to,
      line: line.number,
      column: from - line.from + 1,
      code,
      message: d.message,
    });
  });
  return found;
}

function caretTooltip(state: EditorState): Tooltip | null {
  const here = currentDiagnostics(state).filter((d) => caretIn(state, d.from, d.to));
  const first = here[0];
  if (!first) return null;
  return {
    pos: first.from,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-typecheck-tip';
      for (const d of here) {
        const message = document.createElement('p');
        message.className = 'cm-diagnostic cm-diagnostic-error';
        message.textContent = d.message;
        dom.append(message);
      }
      return { dom };
    },
  };
}

const caretTip = StateField.define<Tooltip | null>({
  create: caretTooltip,
  update(tip, tr) {
    const relevant =
      tr.docChanged ||
      tr.selection !== undefined ||
      tr.effects.some((effect) => effect.is(setDiagnosticsEffect));
    return relevant ? caretTooltip(tr.state) : tip;
  },
  provide: (field) => showTooltip.from(field),
});

/** From tokens only. The underline is wavy, so it does not rely on its colour alone. */
const typecheckTheme = EditorView.theme({
  '.cm-lintRange-error': {
    backgroundImage: 'none',
    textDecorationLine: 'underline',
    textDecorationStyle: 'wavy',
    textDecorationColor: 'var(--danger)',
    textDecorationSkipInk: 'none',
    textUnderlineOffset: '0.25rem',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    color: 'var(--fg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-control)',
    boxShadow: 'var(--shadow-float)',
    maxWidth: 'min(36rem, calc(100vw - 2rem))',
    overflow: 'hidden',
  },
  // A floor on the width: an error near the right edge of a phone would otherwise get a
  // tooltip one word wide. CodeMirror moves a wider tooltip left until it fits.
  '.cm-tooltip-lint, .cm-typecheck-tip': {
    padding: '0',
    margin: '0',
    minWidth: 'min(18rem, calc(100vw - 2rem))',
  },
  '.cm-diagnostic': {
    fontFamily: 'var(--face-mono)',
    fontSize: 'var(--text-sm)',
    lineHeight: '1.25rem',
    padding: '0.5rem 1rem',
    margin: '0',
    whiteSpace: 'pre-wrap',
  },
  '.cm-diagnostic-error': { borderLeft: '2px solid var(--danger)' },
  // The caret's tooltip is for the one typing. Once focus leaves, it would only cover code.
  '&:not(.cm-focused) .cm-typecheck-tip': { display: 'none' },
});

export interface TypecheckExtensionOptions {
  checker: TypeChecker;
  tests: string;
  store: TypecheckStore;
}

export function typecheckExtension({
  checker,
  tests,
  store,
}: TypecheckExtensionOptions): Extension {
  return [
    linter(
      async (view): Promise<Diagnostic[]> => {
        const outcome = await checker.check({ code: view.state.doc.toString(), tests });
        if (outcome.status === 'unavailable') {
          store.setStatus('unavailable');
          return [];
        }
        store.setStatus('ready');
        return outcome.diagnostics.map((d) => ({
          from: d.from,
          to: d.to,
          severity: 'error',
          // Carries the error number without printing it: a beginner reads the message.
          markClass: `cm-ts-${d.code}`,
          message: d.message,
        }));
      },
      {
        delay: CHECK_DELAY_MS,
        // Where the caret is, its own tooltip already shows the message.
        tooltipFilter: (found, state) => found.filter((d) => !caretIn(state, d.from, d.to)),
      },
    ),
    caretTip,
    typecheckTheme,
    // Tooltips stay inside the editor's own width, so on a phone they never touch the
    // screen's edge and read as part of the code box.
    tooltips({
      tooltipSpace: (view) => {
        const box = view.dom.getBoundingClientRect();
        return { top: 0, bottom: window.innerHeight, left: box.left, right: box.right };
      },
    }),
    EditorView.updateListener.of((update) => {
      const changed =
        update.docChanged ||
        update.transactions.some((tr) =>
          tr.effects.some((effect) => effect.is(setDiagnosticsEffect)),
        );
      if (changed) store.setDiagnostics(currentDiagnostics(update.state));
    }),
  ];
}
