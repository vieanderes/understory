import { indentUnit } from '@codemirror/language';
import {
  EditorSelection,
  Prec,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state';
import { Decoration, EditorView, keymap, WidgetType } from '@codemirror/view';

/*
 * A small snippet engine: a keyword chosen from the suggestion row arrives with the
 * brackets and block its grammar demands, and the learner moves through the gaps with
 * the Next key or Tab. @codemirror/autocomplete has one, but it would bring a completion
 * package into an editor whose point is that it completes nothing on its own
 * (docs/MOBILE-EDITING.md, section 4).
 *
 * Template syntax: `${}` is an empty field, `${text}` a field that arrives holding `text`
 * selected, `\n` a line break that keeps the indent of the line the snippet starts on,
 * and `\t` one indent unit of the language.
 */

export interface FieldRange {
  from: number;
  to: number;
}

interface Expanded {
  text: string;
  fields: FieldRange[];
}

const FIELD = /\$\{([^}]*)\}/g;

export function expandTemplate(template: string, unit: string, lineIndent: string): Expanded {
  const laid = template.replace(/\t/g, unit).replace(/\n/g, `\n${lineIndent}`);
  const fields: FieldRange[] = [];
  let text = '';
  let last = 0;
  for (const match of laid.matchAll(FIELD)) {
    text += laid.slice(last, match.index);
    const value = match[1] ?? '';
    fields.push({ from: text.length, to: text.length + value.length });
    text += value;
    last = match.index + match[0].length;
  }
  text += laid.slice(last);
  // After the last gap, Next leaves the block: the caret lands after it.
  const end = fields.at(-1);
  if (end && end.to !== text.length) fields.push({ from: text.length, to: text.length });
  return { text, fields };
}

/** What a chip shows: the template on one line, gaps closed, `if () {}`. */
export function templatePreview(template: string): string {
  return template
    .replace(FIELD, (_, value: string) => value)
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\t/g, '')
    .replace(/\{\s+\}/g, '{}')
    .trim();
}

interface Session {
  fields: FieldRange[];
  active: number;
}

const setSession = StateEffect.define<Session | null>();

function contains(field: FieldRange, from: number, to: number): boolean {
  return from >= field.from && to <= field.to;
}

const sessionField = StateField.define<Session | null>({
  create: () => null,
  update(session, tr) {
    for (const effect of tr.effects) if (effect.is(setSession)) return effect.value;
    if (!session) return null;
    if (tr.docChanged) {
      // Typing inside a field keeps the session. A change that reaches across a field's
      // edge (a paste over the block, Reset) has made the fields meaningless.
      let broken = false;
      const { fields } = session;
      tr.changes.iterChangedRanges((fromA, toA) => {
        const inside = fields.some((f) => contains(f, fromA, toA));
        const touches = fields.some((f) => fromA < f.to && toA > f.from);
        if (!inside && touches) broken = true;
      });
      if (broken) return null;
      session = {
        active: session.active,
        fields: session.fields.map((f) => ({
          from: tr.changes.mapPos(f.from, -1),
          to: tr.changes.mapPos(f.to, 1),
        })),
      };
    }
    // A caret put somewhere else ends it too, or Tab would jump back into an old block.
    const first = session.fields[0];
    const last = session.fields.at(-1);
    const head = tr.state.selection.main.head;
    if (first && last && (head < first.from || head > last.to)) return null;
    return session;
  },
});

class FieldPosition extends WidgetType {
  override toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-snippetFieldPosition';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
  override ignoreEvent(): boolean {
    return false;
  }
}

const fieldMark = Decoration.mark({ class: 'cm-snippetField' });
const fieldSpot = Decoration.widget({ widget: new FieldPosition(), side: 1 });

const fieldDecorations = EditorView.decorations.compute([sessionField], (state) => {
  const session = state.field(sessionField);
  if (!session) return Decoration.none;
  // The end stop is where the caret leaves the block, not a gap to fill: no band.
  const gaps = session.fields.slice(0, -1);
  return Decoration.set(
    gaps.map((f) => (f.from === f.to ? fieldSpot.range(f.from) : fieldMark.range(f.from, f.to))),
    true,
  );
});

function select(view: EditorView, session: Session, index: number): void {
  const field = session.fields[index];
  if (!field) return;
  const done = index === session.fields.length - 1;
  view.dispatch({
    selection: EditorSelection.range(field.from, field.to),
    effects: setSession.of(done ? null : { ...session, active: index }),
    scrollIntoView: true,
    userEvent: 'select',
  });
}

export function hasFields(state: EditorState): boolean {
  return state.field(sessionField, false) != null;
}

export function activeField(state: EditorState): number | null {
  return state.field(sessionField, false)?.active ?? null;
}

export function nextField(view: EditorView): boolean {
  const session = view.state.field(sessionField, false);
  if (!session) return false;
  select(view, session, session.active + 1);
  return true;
}

export function prevField(view: EditorView): boolean {
  const session = view.state.field(sessionField, false);
  if (!session || session.active === 0) return false;
  select(view, session, session.active - 1);
  return true;
}

export function clearFields(view: EditorView): boolean {
  if (!hasFields(view.state)) return false;
  view.dispatch({ effects: setSession.of(null) });
  return true;
}

/** Replaces `from` to `to` (the word typed so far) with the template, and selects its first gap. */
export function insertSnippet(view: EditorView, template: string, from: number, to: number): void {
  const { state } = view;
  if (state.readOnly) return;
  const line = state.doc.lineAt(from);
  const lineIndent = /^\s*/.exec(line.text)?.[0] ?? '';
  const { text, fields } = expandTemplate(template, state.facet(indentUnit), lineIndent);
  const placed = fields.map((f) => ({ from: f.from + from, to: f.to + from }));
  const first = placed[0] ?? { from: from + text.length, to: from + text.length };
  const withSession = state.field(sessionField, false) !== undefined;
  view.dispatch({
    changes: { from, to, insert: text },
    selection: EditorSelection.range(first.from, first.to),
    effects: withSession && placed.length > 1 ? setSession.of({ fields: placed, active: 0 }) : [],
    scrollIntoView: true,
    userEvent: 'input.complete',
  });
}

/**
 * The fields, their band, and Tab, Shift-Tab and Escape while a block is being filled.
 * Outside a block the keys fall through, so Tab indents as it always has.
 */
export function snippetFields(): Extension {
  return [
    sessionField,
    fieldDecorations,
    Prec.highest(
      keymap.of([
        { key: 'Tab', run: nextField, shift: prevField },
        { key: 'Escape', run: clearFields },
      ]),
    ),
  ];
}
