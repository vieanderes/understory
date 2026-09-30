import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearDraft, draftKey, readDraft, writeDraft } from '@/features/editor/draft-store';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('draft store', () => {
  it('keys a draft by lesson and step', () => {
    expect(draftKey('js.coercion', 'write-cart-total')).toBe(
      'understory:draft:js.coercion#write-cart-total',
    );
  });

  it('returns what was written, and null once cleared', () => {
    const key = draftKey('lesson', 'step');
    expect(readDraft(key)).toBeNull();
    writeDraft(key, 'const a = 1;');
    expect(readDraft(key)).toBe('const a = 1;');
    clearDraft(key);
    expect(readDraft(key)).toBeNull();
  });

  it('keeps drafts of different steps apart', () => {
    writeDraft(draftKey('lesson', 'one'), 'one');
    writeDraft(draftKey('lesson', 'two'), 'two');
    expect(readDraft(draftKey('lesson', 'one'))).toBe('one');
  });

  it('survives a storage that refuses every call', () => {
    const refuse = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refuse);
    const key = draftKey('lesson', 'step');
    expect(() => writeDraft(key, 'x')).not.toThrow();
    expect(readDraft(key)).toBeNull();
    expect(() => clearDraft(key)).not.toThrow();
  });
});
