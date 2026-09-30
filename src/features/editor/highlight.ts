import { HighlightStyle } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

/*
 * The same restrained mapping as the build-time highlighter (`--shiki-*` in globals.css),
 * so code reads the same in a lesson and in the editor: one hue for keywords and
 * operators, the status green and amber for strings and constants, neutrals for the
 * rest. Only variables are named here; the theme and the identity swap what they hold.
 * The accent never appears in code, because the accent means "act here" or "gap".
 */
export const understoryHighlight = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.modifier,
      t.operatorKeyword,
      t.operator,
      t.definitionOperator,
      t.typeOperator,
    ],
    color: 'var(--syntax-keyword)',
  },
  { tag: [t.string, t.special(t.string), t.regexp, t.escape], color: 'var(--success)' },
  {
    tag: [t.number, t.bool, t.null, t.atom, t.standard(t.typeName), t.self],
    color: 'var(--warning)',
  },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--faint)' },
  { tag: [t.punctuation, t.separator], color: 'var(--muted)' },
  // Brackets and the member dot stay in the text colour, as they do in lesson code.
  { tag: [t.bracket, t.derefOperator], color: 'var(--fg)' },
  { tag: t.invalid, color: 'var(--fg)' },
  // HTML and CSS, for the playground: tag names like keywords, values like strings, the
  // angle brackets as quiet as other punctuation.
  { tag: t.tagName, color: 'var(--syntax-keyword)' },
  { tag: t.attributeValue, color: 'var(--success)' },
  { tag: t.angleBracket, color: 'var(--muted)' },
  { tag: [t.className, t.unit], color: 'var(--warning)' },
]);
