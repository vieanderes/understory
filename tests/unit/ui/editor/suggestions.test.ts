import { EditorSelection, EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import type { EditorLanguage } from '@/features/editor/extensions';
import { suggest, type AssistMode } from '@/features/editor/suggestions';

/** `|` marks the caret. */
function at(source: string): EditorState {
  const caret = source.indexOf('|');
  return EditorState.create({
    doc: source.replace('|', ''),
    selection: EditorSelection.cursor(caret),
  });
}

function labels(
  source: string,
  language: EditorLanguage = 'js',
  mode: AssistMode = 'unplugged',
  vocabulary?: readonly string[],
): string[] {
  return suggest(at(source), { language, mode, vocabulary }).map((s) => s.label);
}

describe('suggest, unplugged', () => {
  it('offers nothing before the first letter: the learner decides what to write', () => {
    expect(labels('const total = 1;\n|')).toEqual([]);
    expect(labels('const total = 1;\ntotal + |')).toEqual([]);
  });

  it('completes names already in the file, nearest first', () => {
    const doc = 'const total = 1;\nconst tax = 2;\nconst taxes = 3;\nta|';
    expect(labels(doc).slice(0, 2)).toEqual(['taxes', 'tax']);
    expect(labels(doc)).not.toContain('ta');
  });

  it('completes keywords, with the block a keyword opens', () => {
    const [first] = suggest(at('if (x) {\n  retu|\n}'), { language: 'js', mode: 'unplugged' });
    expect(first).toMatchObject({ label: 'return', template: 'return' });

    const block = suggest(at('i|'), { language: 'js', mode: 'unplugged' }).find(
      (s) => s.label === 'if () {}',
    );
    expect(block).toMatchObject({ template: 'if (${}) {\n\t${}\n}', from: 0, to: 1 });
  });

  it('still offers the block when the keyword is typed in full', () => {
    expect(labels('if|')).toContain('if () {}');
  });

  it('never offers an API the file does not use', () => {
    expect(labels('[1, 2].ma|')).toEqual([]);
    expect(labels('cons|')).toEqual(['const']);
    expect(labels('console.log(1);\ncons|')).toEqual(['console', 'const']);
  });

  it('has TypeScript words in ts and tsx only', () => {
    expect(labels('inter|', 'ts')).toContain('interface');
    expect(labels('inter|', 'js')).toEqual([]);
  });

  it('offers Python blocks with a colon and an indented body', () => {
    const def = suggest(at('de|'), { language: 'python', mode: 'unplugged' }).find((s) =>
      s.label.startsWith('def'),
    );
    expect(def?.template).toBe('def ${}(${}):\n\t${}');
    expect(labels('el|', 'python')).toEqual(['elif :', 'else:']);
  });

  it('stays quiet with a selection', () => {
    const state = EditorState.create({
      doc: 'total',
      selection: EditorSelection.range(0, 3),
    });
    expect(suggest(state, { language: 'js', mode: 'unplugged' })).toEqual([]);
  });

  it('offers at most eight', () => {
    const doc = Array.from({ length: 20 }, (_, i) => `const s${i} = ${i};`).join('\n');
    expect(labels(`${doc}\ns|`)).toHaveLength(8);
  });
});

describe('suggest, live', () => {
  it('opens an HTML tag with its end tag after <', () => {
    const [p] = suggest(at('<p|'), { language: 'html', mode: 'live' });
    expect(p).toMatchObject({ label: '<p></p>', template: '<p>${}</p>', from: 0, to: 2 });
    expect(labels('<|', 'html', 'live').length).toBeGreaterThan(0);
  });

  it('offers CSS properties where a declaration starts, then their values', () => {
    const [display] = suggest(at('.box {\n  disp|\n}'), { language: 'css', mode: 'live' });
    expect(display).toMatchObject({ label: 'display: ;', template: 'display: ${};' });
    expect(labels('.box {\n  display: |\n}', 'css', 'live')).toEqual(
      expect.arrayContaining(['flex', 'grid', 'block', 'none']),
    );
    expect(labels('.box {\n  display: fl|\n}', 'css', 'live')).toEqual(['flex']);
  });

  it('matches SQL keywords and the tables in the case the learner writes', () => {
    expect(labels('sel|', 'sql', 'live')).toEqual(['select']);
    expect(labels('SEL|', 'sql', 'live')).toEqual(['SELECT']);
    expect(labels('select * from si|', 'sql', 'live', ['sign_ups', 'email'])).toEqual(['sign_ups']);
  });

  it('adds a few browser words to a playground script', () => {
    expect(labels('document.query|', 'js', 'live')).toEqual(
      expect.arrayContaining(['querySelector', 'querySelectorAll']),
    );
    expect(labels('cons|', 'js', 'live')).toContain('console.log()');
  });
});
