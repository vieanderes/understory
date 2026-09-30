import { describe, expect, it } from 'vitest';
import {
  cleanTitle,
  collapseWhitespace,
  containsTerm,
  countTerm,
  decodeEntities,
  jaccard,
  splitSentences,
  stripHtml,
  titleTokens,
  truncateChars,
  truncateWords,
  wordCount,
} from '@/core/news';

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot; &#8211; &#x2014; &rsquo;')).toBe(
      'a & b <c> "d" – — ’',
    );
  });

  it('leaves unknown and impossible entities alone', () => {
    expect(decodeEntities('&unknown; &#0; &#x110000;')).toBe('&unknown; &#0; &#x110000;');
  });
});

describe('stripHtml', () => {
  it('removes tags, scripts and styles', () => {
    expect(
      stripHtml('<p>One <b>two</b></p><script>alert(1)</script><style>p{}</style> three'),
    ).toBe('One two three');
  });

  it('does not leave a space before punctuation where a tag was', () => {
    expect(stripHtml('Reported by <a href="#">someone</a>. Tags: <a>x</a>, <a>y</a>')).toBe(
      'Reported by someone. Tags: x, y',
    );
  });

  it('collapses whitespace', () => {
    expect(collapseWhitespace('  a \n\t b  ')).toBe('a b');
  });
});

describe('word helpers', () => {
  it('counts words', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  one  two\nthree ')).toBe(3);
  });

  it('truncates by words and marks the cut', () => {
    expect(truncateWords('one two three', 3)).toBe('one two three');
    expect(truncateWords('one two, three four', 2)).toBe('one two...');
    expect(wordCount(truncateWords('a b c d e f', 4))).toBe(4);
  });

  it('truncates by characters at a word boundary', () => {
    expect(truncateChars('short', 10)).toBe('short');
    const cut = truncateChars('The quick brown fox jumps over the lazy dog', 20);
    expect(cut).toBe('The quick brown...');
    expect(cut.length).toBeLessThanOrEqual(20);
  });

  it('cuts inside a word when there is no boundary to use', () => {
    expect(truncateChars('a'.repeat(50), 10)).toBe('aaaaaaa...');
  });
});

describe('splitSentences', () => {
  it('splits on full stops, question marks and exclamation marks', () => {
    expect(splitSentences('One thing. Two things? Three! Four')).toEqual([
      'One thing.',
      'Two things?',
      'Three!',
      'Four',
    ]);
  });

  it('does not split inside version numbers or abbreviations', () => {
    expect(
      splitSentences('Deno 2.9 is out. It adds e.g. Temporal. Cowork v.s. Claude Code.'),
    ).toEqual(['Deno 2.9 is out.', 'It adds e.g. Temporal.', 'Cowork v.s. Claude Code.']);
  });

  it('returns nothing for nothing', () => {
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('titles', () => {
  it('removes aggregator decoration', () => {
    expect(cleanTitle('Show HN:  A tiny runtime')).toBe('A tiny runtime');
    expect(cleanTitle('Vectorized Quicksort (2022)')).toBe('Vectorized Quicksort');
    expect(cleanTitle('Attention is all you need [pdf]')).toBe('Attention is all you need');
  });

  it('tokenises without stopwords, keeping versions and symbols', () => {
    expect([...titleTokens('The State of C++ and Node.js in Deno 2.9.')]).toEqual([
      'state',
      'c++',
      'node.js',
      'deno',
      '2.9',
    ]);
  });

  it('measures overlap', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(1 / 3);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe('term matching', () => {
  it('matches whole words in any case', () => {
    expect(containsTerm('Faster RAG pipelines', 'rag')).toBe(true);
    expect(containsTerm('Cheaper storage', 'rag')).toBe(false);
    expect(countTerm('agent, Agent and agents', 'agent')).toBe(2);
  });

  it('handles terms with punctuation', () => {
    expect(containsTerm('Modern C++ in 2026', 'C++')).toBe(true);
    expect(containsTerm('Next.js 17 is out', 'next.js')).toBe(true);
    expect(containsTerm('What is CI/CD?', 'CI/CD')).toBe(true);
  });

  it('never matches an empty term', () => {
    expect(containsTerm('anything', '  ')).toBe(false);
  });
});
