import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentType } from 'react';
import { describe, expect, it } from 'vitest';
import { AgentLoop } from '@/features/lesson-player/figures/AgentLoop';
import { BoxModel } from '@/features/lesson-player/figures/BoxModel';
import { CallStack } from '@/features/lesson-player/figures/CallStack';
import { DomTree } from '@/features/lesson-player/figures/DomTree';
import { EmbeddingSpace } from '@/features/lesson-player/figures/EmbeddingSpace';
import { EventLoop } from '@/features/lesson-player/figures/EventLoop';
import { LessonFigure } from '@/features/lesson-player/figures/LessonFigure';
import { RagPipeline } from '@/features/lesson-player/figures/RagPipeline';
import { RequestResponse } from '@/features/lesson-player/figures/RequestResponse';
import { ToolUseRoundTrip } from '@/features/lesson-player/figures/ToolUseRoundTrip';

const step = () => screen.getByText(/^Step \d of \d\./).parentElement!;

const FIGURES: [string, ComponentType][] = [
  ['RAG pipeline', RagPipeline],
  ['agent loop', AgentLoop],
  ['tool use round trip', ToolUseRoundTrip],
  ['embedding space', EmbeddingSpace],
  ['call stack', CallStack],
  ['DOM tree', DomTree],
  ['event loop', EventLoop],
  ['box model', BoxModel],
  ['request and response', RequestResponse],
];

describe('figures', () => {
  it.each(FIGURES)('the %s steps from first to last, every step in words', (_, Figure) => {
    render(<Figure />);
    const next = screen.getByRole('button', { name: 'Next' });
    const total = Number(/of (\d+)\./.exec(step().textContent ?? '')![1]);
    expect(total).toBeGreaterThan(2);
    const seen = new Set<string>();
    for (let i = 0; i < total; i += 1) {
      const text = step().textContent ?? '';
      expect(text).toMatch(new RegExp(`^Step ${i + 1} of ${total}\\. \\S`));
      seen.add(text);
      fireEvent.click(next);
    }
    expect(seen.size).toBe(total);
    // Every key line the steps point at exists.
    expect(within(screen.getByRole('list')).getAllByRole('listitem').length).toBeGreaterThan(2);
  });

  it('draws the event loop from the lab engine, so the microtask logs before the timer', () => {
    render(<EventLoop />);
    fireEvent.keyDown(screen.getByRole('group'), { key: 'End' });
    const drawing = screen.getByRole('img');
    const texts = [...drawing.querySelectorAll('text')].map((t) => t.textContent);
    expect(texts.indexOf('microtask: seat confirmed')).toBeLessThan(
      texts.indexOf('timeout: hold expired'),
    );
  });

  it('loads a stepped figure on demand under its caption', async () => {
    render(<LessonFigure id="rag-pipeline" caption="Only the kept chunks reach the model." />);
    expect(screen.getByText('Only the kept chunks reach the model.')).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /The RAG pipeline/ })).toBeInTheDocument();
  });
});
