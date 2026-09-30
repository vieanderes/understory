import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { ACTION_SOURCE, buildPlaygroundDocument, type MissedAction } from '@/core/playground';

/*
 * The action is source text, run in the preview frame and in the gate's jsdom. These
 * tests run it in jsdom against plain DOM listeners; the React path is covered by the
 * gate's tests, which render real components.
 */

type Action = { click: string } | { type: string; into: string };

function page(html: string) {
  const dom = new JSDOM(buildPlaygroundDocument({ html }));
  const act = dom.window.eval(ACTION_SOURCE) as (
    doc: unknown,
    win: unknown,
    action: Action,
  ) => MissedAction | null;
  return {
    doc: dom.window.document,
    run: (action: Action) => act(dom.window.document, dom.window, action),
  };
}

describe('a click', () => {
  it('clicks the first match and misses nothing', () => {
    const { doc, run } = page('<button>a</button><button>b</button>');
    const seen: string[] = [];
    doc.addEventListener('click', (event) =>
      seen.push((event.target as Element).textContent ?? ''),
    );
    expect(run({ click: 'button' })).toBeNull();
    expect(seen).toEqual(['a']);
  });

  it('dispatches a click on an element without a click method', () => {
    const { doc, run } = page('<svg><circle r="4"></circle></svg>');
    let clicks = 0;
    doc.addEventListener('click', () => (clicks += 1));
    expect(run({ click: 'circle' })).toBeNull();
    expect(clicks).toBe(1);
  });

  it('says what it missed: no match, or a selector that does not parse', () => {
    const { run } = page('<p>x</p>');
    expect(run({ click: 'button' })).toEqual({ action: 'click', selector: 'button' });
    expect(run({ click: 'p[' })).toEqual({ action: 'click', selector: 'p[', invalid: true });
  });

  it('never clicks what the playground added', () => {
    const { run } = page('<p>x</p>');
    expect(run({ click: 'meta' })).toEqual({ action: 'click', selector: 'meta' });
  });
});

describe('typing', () => {
  it('adds the text to the value and fires input between key events', () => {
    const { doc, run } = page('<input value="a"><textarea></textarea>');
    const events: string[] = [];
    for (const type of ['keydown', 'input', 'keyup']) {
      doc.addEventListener(type, (event) => {
        const field = event.target as HTMLInputElement;
        events.push(`${type}:${field.value}`);
      });
    }
    expect(run({ type: 'b', into: 'input' })).toBeNull();
    expect(events).toEqual(['keydown:a', 'input:ab', 'keyup:ab']);
    expect(doc.activeElement?.localName).toBe('input');
    expect(run({ type: 'Hi', into: 'textarea' })).toBeNull();
    expect((doc.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Hi');
  });

  it('refuses an element that takes no typing, and a field that is not there', () => {
    const { run } = page('<p>x</p>');
    expect(run({ type: 'a', into: 'p' })).toEqual({
      action: 'type',
      selector: 'p',
      notField: true,
    });
    expect(run({ type: 'a', into: 'input' })).toEqual({ action: 'type', selector: 'input' });
    expect(run({ type: 'a', into: '[' })).toEqual({ action: 'type', selector: '[', invalid: true });
  });
});
