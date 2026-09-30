import { Fragment, isValidElement, type ReactNode } from 'react';

/*
 * A title is split into lines by GSAP, and SplitText puts the original back by resetting
 * innerHTML. If React owned those text nodes it would lose them, and a later update would
 * write to nodes no longer on the page. So a title is rendered as a string of HTML that
 * React sets as a whole: SplitText can split and restore it freely.
 *
 * Titles hold text and a few inline elements (a muted half, a figure, code), so this
 * is deliberately tiny and throws on anything it does not know.
 */
const INLINE = new Set(['span', 'em', 'strong', 'code']);

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export function toStaticHtml(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return escape(String(node));
  if (Array.isArray(node)) return node.map(toStaticHtml).join('');
  if (isValidElement<{ children?: ReactNode; className?: string }>(node)) {
    if (node.type === Fragment) return toStaticHtml(node.props.children);
    if (typeof node.type === 'string' && INLINE.has(node.type)) {
      const cls = node.props.className ? ` class="${escape(node.props.className)}"` : '';
      return `<${node.type}${cls}>${toStaticHtml(node.props.children)}</${node.type}>`;
    }
  }
  throw new Error('A title holds text, <span>, <em>, <strong> and <code> only.');
}
