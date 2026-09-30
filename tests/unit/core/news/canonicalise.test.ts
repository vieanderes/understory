import { describe, expect, it } from 'vitest';
import { canonicalise, itemId } from '@/core/news';

describe('canonicalise', () => {
  it.each([
    [
      'strips utm parameters',
      'https://example.com/a?utm_source=hn&utm_medium=x',
      'https://example.com/a',
    ],
    [
      'strips click ids',
      'https://example.com/a?fbclid=1&gclid=2&mc_cid=3',
      'https://example.com/a',
    ],
    [
      'keeps parameters that select content',
      'https://example.com/a?id=7&utm_campaign=x',
      'https://example.com/a?id=7',
    ],
    [
      'sorts the remaining parameters',
      'https://example.com/a?b=2&a=1',
      'https://example.com/a?a=1&b=2',
    ],
    ['drops the fragment', 'https://example.com/a#section-2', 'https://example.com/a'],
    ['drops www', 'https://www.example.com/a', 'https://example.com/a'],
    ['drops a trailing slash', 'https://example.com/a/', 'https://example.com/a'],
    ['reduces the root to the origin', 'https://example.com/', 'https://example.com'],
    [
      'lower-cases the host, not the path',
      'https://Example.COM/Blog/Post',
      'https://example.com/Blog/Post',
    ],
    ['treats http and https as one page', 'http://example.com/a', 'https://example.com/a'],
    ['drops a default port', 'https://example.com:443/a', 'https://example.com/a'],
    ['keeps an unusual port', 'https://example.com:8443/a', 'https://example.com:8443/a'],
    ['trims whitespace', '  https://example.com/a \n', 'https://example.com/a'],
  ])('%s', (_name, input, expected) => {
    expect(canonicalise(input)).toBe(expected);
  });

  it.each([
    'https://arxiv.org/abs/2609.16338',
    'https://arxiv.org/abs/2609.16338v2',
    'http://arxiv.org/abs/2609.16338v1',
    'https://arxiv.org/pdf/2609.16338',
    'https://arxiv.org/pdf/2609.16338v3.pdf',
    'https://www.arxiv.org/pdf/2609.16338v3',
    'https://export.arxiv.org/abs/2609.16338v1',
  ])('maps %s to the one abstract page', (input) => {
    expect(canonicalise(input)).toBe('https://arxiv.org/abs/2609.16338');
  });

  it('handles old-style arXiv ids', () => {
    expect(canonicalise('https://arxiv.org/pdf/cs/0703001v2.pdf')).toBe(
      'https://arxiv.org/abs/cs/0703001',
    );
  });

  it.each([
    '',
    'not a url',
    'ftp://example.com/a',
    'mailto:someone@example.com',
    'javascript:alert(1)',
  ])('rejects %j', (input) => {
    expect(canonicalise(input)).toBeNull();
  });

  it('is idempotent', () => {
    const once = canonicalise('http://www.Example.com/a/?utm_source=x&b=1#top');
    expect(once).not.toBeNull();
    expect(canonicalise(once ?? '')).toBe(once);
  });
});

describe('itemId', () => {
  it('is a stable 16-digit hex hash', () => {
    const id = itemId('https://example.com/a');
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(itemId('https://example.com/a')).toBe(id);
    // Pinned: a changed hash would orphan every stored item and recall card.
    expect(itemId('https://example.com/a')).toBe('046a4934057f51cf');
    // The published FNV-1a 64-bit test vector, so the Swift port can check itself.
    expect(itemId('a')).toBe('af63dc4c8601ec8c');
  });

  it('differs for different URLs', () => {
    expect(itemId('https://example.com/a')).not.toBe(itemId('https://example.com/b'));
  });
});
