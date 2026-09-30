import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualViewport } from '@/features/editor/useVisualViewport';

function Probe() {
  const rect = useVisualViewport();
  return <output>{JSON.stringify(rect)}</output>;
}

function fakeViewport(overrides: Partial<VisualViewport> = {}) {
  const target = new EventTarget();
  const viewport = Object.assign(target, {
    offsetTop: 0,
    offsetLeft: 0,
    width: 390,
    height: 844,
    scale: 1,
    pageTop: 0,
    pageLeft: 0,
    ...overrides,
  }) as unknown as VisualViewport;
  vi.stubGlobal('visualViewport', viewport);
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
  return viewport;
}

afterEach(() => vi.unstubAllGlobals());

describe('useVisualViewport', () => {
  it('reports no keyboard while the visual viewport fills the layout viewport', () => {
    fakeViewport();
    render(<Probe />);
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({
      top: 0,
      left: 0,
      width: 390,
      height: 844,
      keyboard: 0,
    });
  });

  it('measures the keyboard from what the visual viewport no longer covers', () => {
    const viewport = fakeViewport();
    render(<Probe />);
    act(() => {
      Object.assign(viewport, { height: 544, offsetTop: 40 });
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toMatchObject({
      top: 40,
      height: 544,
      keyboard: 260,
    });
  });

  it('does not take a pinch-zoom for a keyboard', () => {
    const viewport = fakeViewport();
    render(<Probe />);
    act(() => {
      Object.assign(viewport, { height: 422, width: 195, scale: 2 });
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toMatchObject({
      height: 422,
      keyboard: 0,
    });
  });

  it('ignores the browser chrome coming and going', () => {
    const viewport = fakeViewport();
    render(<Probe />);
    act(() => {
      Object.assign(viewport, { height: 760 });
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toMatchObject({
      keyboard: 0,
    });
  });
});
