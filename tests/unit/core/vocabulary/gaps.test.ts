import { describe, expect, it } from 'vitest';
import { keyTermsOf, wordGaps } from '@/core/vocabulary/gaps';

const words = [
  { id: 'closure', names: ['closure', 'lexical closure'] },
  { id: 'scope', names: ['scope'] },
  { id: 'callback', names: ['callback'] },
];

describe('keyTermsOf', () => {
  it('reads the bold terms a lesson introduces, once each, in order', () => {
    expect(
      keyTermsOf([
        'A **closure** keeps its **scope**.',
        'Another **Closure**, and **`useEffect`**.',
      ]),
    ).toEqual(['closure', 'scope', 'useEffect']);
  });
});

describe('wordGaps', () => {
  const texts = ['A **closure** keeps its scope. The scope matters, and so does **hoisting**.'];

  it('suggests existing words the lesson says, most said first', () => {
    expect(wordGaps(texts, ['hoisting'], words).toPin).toEqual(['scope', 'closure']);
  });

  it('lists key terms the vocabulary does not have yet', () => {
    expect(
      wordGaps(texts, ['Temporal dead zone', 'Callbacks', 'callback hell'], words).missing,
    ).toEqual(['hoisting', 'Temporal dead zone', 'callback hell']);
  });
});
