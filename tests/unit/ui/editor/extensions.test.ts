import { indentUnit, language } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { languageExtension } from '@/features/editor/extensions';

function stateFor(lang: 'js' | 'ts' | 'python'): EditorState {
  return EditorState.create({ doc: '', extensions: languageExtension(lang) });
}

describe('languageExtension', () => {
  it('gives Python its grammar and a four-space indent', () => {
    const state = stateFor('python');
    expect(state.facet(language)?.name).toBe('python');
    expect(state.facet(indentUnit)).toBe('    ');
    expect(state.tabSize).toBe(4);
  });

  it('keeps two spaces for JavaScript and TypeScript', () => {
    for (const lang of ['js', 'ts'] as const) {
      const state = stateFor(lang);
      expect(state.facet(language)?.name).toMatch(/javascript|typescript/);
      expect(state.facet(indentUnit)).toBe('  ');
      expect(state.tabSize).toBe(2);
    }
  });
});
