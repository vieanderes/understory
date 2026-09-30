import { describe, expect, it } from 'vitest';
import {
  buildPlaygroundDocument,
  compileComponent,
  REACT_ROOT_ID,
  type ComponentModule,
} from '@/core/playground';
import type { Transpiler } from '@/core/ports/code-runner';
import { TranspileError } from '@/core/running/transpile-error';

const cspOf = (doc: string): string =>
  /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(doc)?.[1] ?? '';

const RUNTIME = 'window.__understoryReact = {};';
const react = (component: ComponentModule) => ({ runtime: RUNTIME, component });

describe('compileComponent', () => {
  const transpiler = (strip: Transpiler['strip']): Transpiler => ({ strip });

  it('transpiles the file as tsx', () => {
    const seen: string[] = [];
    const result = compileComponent(
      transpiler((src, lang) => {
        seen.push(lang);
        return `compiled:${src}`;
      }),
      'x',
    );
    expect(result).toEqual({ code: 'compiled:x' });
    expect(seen).toEqual(['tsx']);
  });

  it('turns a syntax error into a message with the line, or without one', () => {
    const at = compileComponent(
      transpiler(() => {
        throw new TranspileError('Unexpected token', 3);
      }),
      'x',
    );
    expect(at).toEqual({ error: 'Unexpected token', line: 3 });
    const nowhere = compileComponent(
      transpiler(() => {
        throw new TranspileError('Broken');
      }),
      'x',
    );
    expect(nowhere).toEqual({ error: 'Broken' });
  });

  it('keeps any other failure as a message', () => {
    expect(
      compileComponent(
        transpiler(() => {
          throw new Error('odd');
        }),
        'x',
      ),
    ).toEqual({ error: 'odd' });
    expect(
      compileComponent(
        transpiler(() => {
          throw 'text';
        }),
        'x',
      ),
    ).toEqual({ error: 'text' });
  });
});

describe('a React page', () => {
  const component = { code: '"use strict";\nexports.default = App;' };

  it('adds the root, then the runtime, then the module, after the HTML', () => {
    const doc = buildPlaygroundDocument(
      { html: '<h1>Shop</h1>', jsx: 'x' },
      { react: react(component) },
    );
    const root = doc.indexOf(`<div id="${REACT_ROOT_ID}"></div>`);
    expect(doc.indexOf('<h1>Shop</h1>')).toBeLessThan(root);
    expect(root).toBeLessThan(doc.indexOf(RUNTIME));
    expect(doc.indexOf(RUNTIME)).toBeLessThan(doc.indexOf('exports.default = App'));
    expect(doc).toContain(
      'window.__understoryModule = function (exports, require, module) {"use strict";',
    );
  });

  it('uses a root the HTML already has', () => {
    const doc = buildPlaygroundDocument(
      { html: '<main id="root" class="app"></main>', jsx: 'x' },
      { react: react(component) },
    );
    expect(doc).not.toContain(`<div id="${REACT_ROOT_ID}">`);
  });

  it('lets scripts run, and still allows no network', () => {
    const csp = cspOf(
      buildPlaygroundDocument(
        { jsx: 'x' },
        { react: react(component), probe: { nonce: 'n1', checks: [] } },
      ),
    );
    expect(csp).toContain("script-src 'unsafe-inline'");
    expect(csp).toContain("default-src 'none'");
    expect(csp).not.toMatch(/connect-src|https?:/);
  });

  it('marks the line where the learner file starts, for error lines', () => {
    const doc = buildPlaygroundDocument(
      { html: '<p>\n\n</p>', jsx: 'x' },
      { react: react(component), probe: { nonce: 'n1', checks: [] } },
    );
    const lead = doc.lastIndexOf('window.__understoryModule =');
    const line = doc.slice(0, lead).split('\n').length;
    expect(doc).toContain(`parseInt("${String(line).padStart(7, '0')}", 10)`);
    expect(doc).toContain('var lineCount = 2;');
  });

  it('mounts without a probe too, as the solution preview does, and reports nothing', () => {
    const doc = buildPlaygroundDocument({ jsx: 'x' }, { react: react(component) });
    expect(doc).toContain('var nonce = null;');
    expect(doc).toContain('window.__understoryModule');
  });

  it('carries a compile error into the page instead of the module', () => {
    const doc = buildPlaygroundDocument(
      { jsx: 'x' },
      { react: react({ error: 'Unexpected token </b>', line: 4 }) },
    );
    expect(doc).not.toContain('window.__understoryModule =');
    expect(doc).toContain('SyntaxError: Unexpected token \\u003c/b> (line 4)');
    expect(buildPlaygroundDocument({ jsx: 'x' }, { react: react({ error: 'Broken' }) })).toContain(
      '"SyntaxError: Broken"',
    );
  });

  it('keeps a closing script tag in the learner code from ending the module', () => {
    const doc = buildPlaygroundDocument(
      { jsx: 'x' },
      { react: react({ code: 'const s = "</script><b>x</b>";' }) },
    );
    expect(doc).toContain('"<\\/script><b>x</b>"');
  });

  it('refuses to build a React page without React', () => {
    expect(() => buildPlaygroundDocument({ jsx: 'x' })).toThrow(/options\.react/);
  });
});
