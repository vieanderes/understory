import { describe, expect, it } from 'vitest';
import { buildPlaygroundDocument, isFullDocument, mergeSources } from '@/core/playground';

const cspOf = (doc: string): string =>
  /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(doc)?.[1] ?? '';

describe('isFullDocument', () => {
  it('tells a fragment from a whole document', () => {
    expect(isFullDocument('<h1>Hi</h1>')).toBe(false);
    expect(isFullDocument('<!DOCTYPE html><title>x</title>')).toBe(true);
    expect(isFullDocument('<html lang="en"><body></body></html>')).toBe(true);
    expect(isFullDocument('<head><title>x</title></head>')).toBe(true);
    expect(isFullDocument('<body>x</body>')).toBe(true);
    // A tag that only starts with the same letters is not the document element.
    expect(isFullDocument('<header>x</header>')).toBe(false);
  });
});

describe('buildPlaygroundDocument', () => {
  it('wraps a fragment in a document the browser would build anyway', () => {
    const doc = buildPlaygroundDocument({ html: '<h1>Pancakes</h1>' });
    expect(doc.startsWith('<!doctype html><html lang="en"><head>')).toBe(true);
    expect(doc).toContain('<body><h1>Pancakes</h1>');
    expect(doc.endsWith('</body></html>')).toBe(true);
  });

  it('paints the browser page ground with zero specificity, so any learner rule wins', () => {
    const doc = buildPlaygroundDocument({ html: '<p>x</p>', css: 'html { background: none; }' });
    const ground = doc.indexOf(':where(html){background-color:Canvas}');
    expect(ground).toBeGreaterThan(-1);
    expect(ground).toBeLessThan(doc.indexOf('html { background: none; }'));
  });

  it('puts the CSS in a style element marked as ours', () => {
    const doc = buildPlaygroundDocument({ html: '<p>x</p>', css: 'p { color: teal; }' });
    expect(doc).toContain('<style data-understory>p { color: teal; }</style>');
  });

  it('cannot be broken out of by a closing style or script tag in the sources', () => {
    const doc = buildPlaygroundDocument({
      html: '<p>x</p>',
      css: 'p{}</STYLE><script>alert(1)</script>',
      js: 'const s = "</script><b>x</b>";',
    });
    expect(doc).not.toMatch(/<\/style><script>alert/i);
    expect(doc).toContain('<\\/STYLE>');
    expect(doc).toContain('"<\\/script><b>x</b>"');
  });

  it('blocks every script except the probe when the step has no JavaScript', () => {
    const doc = buildPlaygroundDocument(
      { html: '<script>alert(1)</script>' },
      { probe: { nonce: 'abc123', checks: [] } },
    );
    const scripts = cspOf(doc)
      .split('; ')
      .find((directive) => directive.startsWith('script-src'));
    expect(scripts).toBe("script-src 'nonce-abc123'");
    expect(doc).toContain('<script data-understory nonce="abc123">');
  });

  it('lets inline scripts run when the step has JavaScript, and runs it after the HTML', () => {
    const doc = buildPlaygroundDocument({ html: '<h1>a</h1>', js: 'document.title = "b";' });
    expect(cspOf(doc)).toContain("script-src 'unsafe-inline'");
    expect(doc.indexOf('<h1>a</h1>')).toBeLessThan(doc.indexOf('document.title'));
    expect(doc).toContain('<script data-understory>document.title = "b";</script></body>');
  });

  it('never allows the network: no connect, no remote images, no frames', () => {
    const csp = cspOf(buildPlaygroundDocument({ html: '<p>x</p>', js: '1' }));
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('img-src data: blob:');
    expect(csp).not.toMatch(/connect-src|https?:/);
  });

  it('puts the policy first in the head, before any author content', () => {
    const doc = buildPlaygroundDocument({ html: '<p>x</p>' });
    expect(doc.indexOf('Content-Security-Policy')).toBeLessThan(doc.indexOf('<p>x</p>'));
  });

  it('injects into an existing head of a whole document, keeping its own elements', () => {
    const html =
      '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<title>Menu</title>\n</head>\n<body>\n<h1>Menu</h1>\n</body>\n</html>';
    const doc = buildPlaygroundDocument({ html, css: 'h1{}', js: 'x()' });
    expect(doc.startsWith('<!DOCTYPE html>\n<html lang="fr">\n<head><meta data-understory')).toBe(
      true,
    );
    expect(doc).toContain('<title>Menu</title>');
    expect(doc).toContain('<script data-understory>x()</script></body>');
    expect(doc.indexOf('<style data-understory>')).toBeLessThan(doc.indexOf('<title>Menu'));
  });

  it('injects after the html tag when a document has no head, and appends without a body end', () => {
    const doc = buildPlaygroundDocument({ html: '<html><p>x</p>', js: 'y()' });
    expect(doc.startsWith('<html><meta data-understory')).toBe(true);
    expect(doc.endsWith('<script data-understory>y()</script>')).toBe(true);
  });

  it('injects at the very start of a document that has only a doctype or a body', () => {
    const doc = buildPlaygroundDocument({ html: '<body><p>x</p></body>' });
    expect(doc.startsWith('<meta data-understory')).toBe(true);
  });

  it('embeds the probe with its checks, escaped so no text can close the script', () => {
    const doc = buildPlaygroundDocument(
      { html: '<p>x</p>' },
      { probe: { nonce: 'n1', checks: [{ label: '</script>', selector: 'p' }] } },
    );
    expect(doc).toContain('understory-playground');
    expect(doc).toContain('"n1"');
    expect(doc).not.toContain('"label":"</script>"');
    expect(doc).toContain('\\u003c/script>');
  });

  it('refuses a nonce that could break out of the attribute', () => {
    expect(() =>
      buildPlaygroundDocument({ html: '' }, { probe: { nonce: '"><x', checks: [] } }),
    ).toThrow(/nonce/);
  });
});

describe('mergeSources', () => {
  it('takes each field from the override when it has one, else from the starter', () => {
    expect(mergeSources({ html: 'a', css: 'b' }, { css: 'c' })).toEqual({ html: 'a', css: 'c' });
    expect(mergeSources({ html: 'a', js: 'j' }, {})).toEqual({ html: 'a', js: 'j' });
  });
});
