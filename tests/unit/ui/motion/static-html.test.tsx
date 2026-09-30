import { describe, expect, it } from 'vitest';
import { toStaticHtml } from '@/features/motion/static-html';

function Custom() {
  return <b>no</b>;
}

describe('toStaticHtml', () => {
  it('renders text, figures and the muted half of a title', () => {
    const due = 3;
    expect(
      toStaticHtml(
        <>
          <span className="t-figure">{due}</span> due.{' '}
          <span className="text-muted">None lost yet.</span>
        </>,
      ),
    ).toBe('<span class="t-figure">3</span> due. <span class="text-muted">None lost yet.</span>');
  });

  it('escapes text and class names, so feed text can never become markup', () => {
    expect(toStaticHtml(<span className={'a" onclick="x'}>{'<img src=x>'} & co</span>)).toBe(
      '<span class="a&quot; onclick=&quot;x">&lt;img src=x&gt; &amp; co</span>',
    );
  });

  it('skips empty values and flattens arrays', () => {
    expect(toStaticHtml([null, false, 'a', undefined, ['b', 1]])).toBe('ab1');
  });

  it('refuses anything but text and inline spans', () => {
    expect(() => toStaticHtml(<Custom />)).toThrow(/text, <span>/);
    expect(() => toStaticHtml(<div>block</div>)).toThrow();
  });
});
