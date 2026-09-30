import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { escapeInlineScript, renderRunner } from '@/adapters/sandbox/frame/runner-template';
import { buildSandboxArtefacts } from '../../../../scripts/build-sandbox';

describe('sandbox artefacts', () => {
  it('are committed in the state the build script produces', async () => {
    // A stale runner would run an old harness in the browser while CI runs the new one.
    for (const artefact of await buildSandboxArtefacts()) {
      const committed = readFileSync(artefact.file, 'utf8');
      expect(
        committed === artefact.content,
        `${path.basename(artefact.file)} is stale. Run: pnpm exec tsx scripts/build-sandbox.ts`,
      ).toBe(true);
    }
  });

  it('builds a runner with exactly one inline script and no external reference', async () => {
    const runner = (await buildSandboxArtefacts()).find((a) => a.file.endsWith('runner.v1.html'));
    expect(runner).toBeDefined();
    const html = runner?.content ?? '';
    expect(html.match(/<script/gi)).toHaveLength(1);
    expect(html.match(/<\/script/gi)).toHaveLength(1);
    expect(html).not.toMatch(/\s(src|href)=/i);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('Understory test harness v1');
    // Small enough to inline. The protocol schemas (zod) are most of it.
    expect(html.length).toBeLessThan(200 * 1024);
  });
});

describe('the React playground runtime', () => {
  it('can be inlined in a page as it is, and stays small', async () => {
    const runtime = (await buildSandboxArtefacts()).find((a) =>
      a.file.endsWith('react-playground.v1.js'),
    );
    const text = runtime?.content ?? '';
    expect(text).toContain('Understory React playground runtime v1');
    expect(text).not.toMatch(/<\/script|<!--/i);
    // React and react-dom's development builds, minified, and nothing else of the app.
    expect(text.length).toBeLessThan(480 * 1024);
    expect(text).not.toMatch(/understory-playground|zod/);
  });
});

describe('inline script escaping', () => {
  it('breaks up the sequences that end or derail an inline script', () => {
    const escaped = escapeInlineScript('const a = "</script><!-- </SCRIPT>";');
    expect(escaped).toBe('const a = "<\\/script><\\!-- <\\/SCRIPT>";');
    // Same string value once JavaScript has read the escapes.
    expect(new Function(`${escaped} return a;`)()).toBe('</script><!-- </SCRIPT>');
  });

  it('inserts the script literally, dollar signs included', () => {
    expect(renderRunner("var a='$&$1$$';")).toContain("<script>var a='$&$1$$';</script>");
  });
});
