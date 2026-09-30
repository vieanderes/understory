import { JSDOM, VirtualConsole } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  buildPlaygroundDocument,
  PLAYGROUND_MESSAGE_SOURCE,
  PROBE_SOURCE,
  MAX_TREE_ROWS,
  parsePlaygroundMessage,
  type PlaygroundCheck,
  type ProbeReport,
} from '@/core/playground';

/*
 * The probe is source text, evaluated inside the preview frame in a browser and inside
 * jsdom by the content gate. These tests run it the way the gate does.
 */

function probe(html: string, checks: PlaygroundCheck[], css = ''): ProbeReport {
  const dom = new JSDOM(buildPlaygroundDocument({ html, css }));
  const run = dom.window.eval(PROBE_SOURCE) as (
    doc: unknown,
    win: unknown,
    checks: PlaygroundCheck[],
    errors: string[],
  ) => ProbeReport;
  return run(dom.window.document, dom.window, checks, []);
}

describe('the probe', () => {
  it('counts matches and reads the text, attribute and computed style of the first', () => {
    const report = probe(
      '<h1 id="top">  Hot pancakes </h1><h1>Second</h1><img alt="A stack">',
      [
        { label: 'a', selector: 'h1', text: 'x' },
        { label: 'b', selector: 'img', attribute: { name: 'alt' } },
        { label: 'c', selector: 'h1', style: { property: 'color', value: 'x' } },
        { label: 'd', selector: 'img', attribute: { name: 'title' } },
      ],
      'h1 { color: teal; }',
    );
    expect(report.facts).toEqual([
      { count: 2, text: '  Hot pancakes ' },
      { count: 1, attribute: 'A stack' },
      { count: 2, style: 'rgb(0, 128, 128)' },
      { count: 1, attribute: null },
    ]);
  });

  it('marks an invalid selector instead of throwing', () => {
    expect(probe('<p>x</p>', [{ label: 'a', selector: 'p[' }]).facts).toEqual([
      { count: 0, invalid: true },
    ]);
  });

  it('leaves out the elements the playground injected', () => {
    const report = probe('<p>x</p>', [
      { label: 'a', selector: 'style' },
      { label: 'b', selector: 'meta' },
    ]);
    expect(report.facts.map((f) => f.count)).toEqual([0, 0]);
    expect(report.tree.some((row) => row.kind === 'element' && row.tag === 'style')).toBe(false);
  });

  it('reports no text, attribute or style when nothing matches', () => {
    expect(
      probe('', [{ label: 'a', selector: 'h1', text: 'x', attribute: { name: 'id' } }]).facts,
    ).toEqual([{ count: 0 }]);
  });

  it('draws the tree as indented rows: tags, key attributes, shortened text', () => {
    const report = probe(
      `<main class="page"><h1 id="top">Menu</h1><p>${'word '.repeat(30)}</p><!-- note --></main>`,
      [],
    );
    const rows = report.tree;
    expect(rows[0]).toEqual({
      depth: 0,
      kind: 'element',
      tag: 'html',
      attrs: [{ name: 'lang', value: 'en' }],
    });
    expect(rows[1]).toMatchObject({ depth: 1, kind: 'element', tag: 'head' });
    expect(rows[2]).toMatchObject({ depth: 1, kind: 'element', tag: 'body' });
    expect(rows[3]).toEqual({
      depth: 2,
      kind: 'element',
      tag: 'main',
      attrs: [{ name: 'class', value: 'page' }],
    });
    expect(rows[4]).toMatchObject({ depth: 3, tag: 'h1', attrs: [{ name: 'id', value: 'top' }] });
    expect(rows[5]).toEqual({ depth: 4, kind: 'text', text: 'Menu' });
    const long = rows[7];
    expect(long).toMatchObject({ depth: 4, kind: 'text' });
    expect(long?.kind === 'text' && long.text.endsWith('…')).toBe(true);
    expect(rows[8]).toEqual({ depth: 3, kind: 'comment', text: 'note' });
    expect(report.truncated).toBe(false);
  });

  it('skips text that is only white space, as browser developer tools do', () => {
    const rows = probe('<ul>\n  <li>a</li>\n</ul>', []).tree;
    expect(rows.filter((row) => row.kind === 'text')).toEqual([
      { depth: 4, kind: 'text', text: 'a' },
    ]);
  });

  it('stops at a bounded number of rows and says so', () => {
    const report = probe('<p>x</p>'.repeat(MAX_TREE_ROWS), []);
    expect(report.tree.length).toBe(MAX_TREE_ROWS);
    expect(report.truncated).toBe(true);
  });

  it('keeps at most four attributes per element, each value shortened', () => {
    const rows = probe(`<a href="${'x'.repeat(60)}" a="1" b="2" c="3" d="4">x</a>`, []).tree;
    const link = rows.find((row) => row.kind === 'element' && row.tag === 'a');
    expect(link?.kind === 'element' && link.attrs.length).toBe(4);
    expect(link?.kind === 'element' && link.attrs[0]?.value.endsWith('…')).toBe(true);
  });
});

describe('the frame script', () => {
  it('posts a report the parent accepts once the page has loaded', async () => {
    const doc = buildPlaygroundDocument(
      { html: '<h1>Pancakes</h1>', js: 'document.querySelector("h1").textContent = "Waffles";' },
      { probe: { nonce: 'n42', checks: [{ label: 'a', selector: 'h1', text: 'x' }] } },
    );
    const dom = new JSDOM(doc, { runScripts: 'dangerously' });
    const message = await new Promise<unknown>((resolve) => {
      dom.window.addEventListener('message', (event) => resolve(event.data));
    });
    const parsed = parsePlaygroundMessage(message);
    expect(parsed?.source).toBe(PLAYGROUND_MESSAGE_SOURCE);
    expect(parsed?.nonce).toBe('n42');
    expect(parsed?.report.facts).toEqual([{ count: 1, text: 'Waffles' }]);
    dom.window.close();
  });

  it('reports an error thrown by the learner script', async () => {
    const doc = buildPlaygroundDocument(
      { html: '<p>x</p>', js: 'missing();' },
      { probe: { nonce: 'n1', checks: [] } },
    );
    // A quiet console: the thrown error is the point of the test, not noise in its output.
    const dom = new JSDOM(doc, { runScripts: 'dangerously', virtualConsole: new VirtualConsole() });
    const message = await new Promise<unknown>((resolve) => {
      dom.window.addEventListener('message', (event) => resolve(event.data));
    });
    expect(parsePlaygroundMessage(message)?.report.errors[0]).toMatch(/missing/);
    dom.window.close();
  });
});

describe('parsePlaygroundMessage', () => {
  const valid = {
    source: PLAYGROUND_MESSAGE_SOURCE,
    nonce: 'n1',
    report: { facts: [{ count: 1 }], tree: [], truncated: false, errors: [] },
  };

  it('accepts a well-formed report', () => {
    expect(parsePlaygroundMessage(valid)).toEqual(valid);
  });

  it('drops anything else, since the frame runs learner code', () => {
    expect(parsePlaygroundMessage(null)).toBeNull();
    expect(parsePlaygroundMessage({ ...valid, source: 'other' })).toBeNull();
    expect(parsePlaygroundMessage({ ...valid, report: { facts: 'x' } })).toBeNull();
  });
});
