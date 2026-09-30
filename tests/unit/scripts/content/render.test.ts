import { beforeAll, describe, expect, it } from 'vitest';
import { createRenderer } from '../../../../scripts/lib/render';
import type { Renderer } from '../../../../scripts/lib/render';

describe('createRenderer', () => {
  let renderer: Renderer;
  beforeAll(async () => {
    renderer = await createRenderer(['js', 'html']);
  });

  it('renders block markdown to paragraphs', () => {
    expect(renderer.markdown('The total is **wrong**.')).toBe(
      '<p>The total is <strong>wrong</strong>.</p>\n',
    );
  });

  it('renders inline markdown with no paragraph, so it fits inside a button', () => {
    expect(renderer.inline('`"21"` as text')).toBe('<code>&quot;21&quot;</code> as text');
  });

  it('escapes raw HTML instead of passing it through', () => {
    const html = renderer.markdown('Hello <b>bold</b>\n\n<script>alert(1)</script>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes raw HTML in inline markdown too', () => {
    expect(renderer.inline('a <i>b</i>')).toBe('a &lt;i&gt;b&lt;/i&gt;');
  });

  it('highlights code with CSS variables and numbers each line', () => {
    const html = renderer.code('const total = "2" + 1;\nconsole.log(total);', 'js');
    expect(html).toContain('var(--shiki-token-keyword)');
    expect(html).toContain('data-line="1"');
    expect(html).toContain('data-line="2"');
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('highlights fenced code inside markdown with the same highlighter', () => {
    const html = renderer.markdown('Read this.\n\n```js\nconst a = 1;\n```');
    expect(html).toContain('class="shiki');
    expect(html).toContain('var(--shiki-token-keyword)');
  });

  it('falls back to plain text for a fence with an unknown or missing language', () => {
    const html = renderer.markdown('```cobol\nMOVE 1 TO TOTAL.\n```\n\n```\nplain\n```');
    expect(html).toContain('MOVE 1 TO TOTAL.');
    expect(html).toContain('plain');
  });

  it('escapes code, so markup in a sample is shown and not run', () => {
    expect(renderer.code('<b>bold</b>', 'html')).toContain('&#x3C;');
  });

  it('shares one highlighter between renderers', async () => {
    const again = await createRenderer(['js']);
    expect(again.code('let a;', 'js')).toBe(renderer.code('let a;', 'js'));
  });
});
