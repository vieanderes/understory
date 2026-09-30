import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeEditor from '@/features/editor/CodeEditor';

/** A phone: every `(pointer: coarse)` and width query matches. */
function coarsePointer(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('CodeEditor on a phone', () => {
  beforeEach(() => coarsePointer(true));

  it('opens the same editor full screen, with Run and Done, and returns focus on Done', () => {
    const onRun = vi.fn();
    render(
      <CodeEditor
        value="let x = 1;"
        language="js"
        ariaLabel="Your code"
        onRun={onRun}
        runLabel="Run tests"
        runStatus="2 of 3 pass"
      />,
    );
    const textbox = screen.getByRole('textbox', { name: 'Your code' });
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));

    const dialog = screen.getByRole('dialog', { name: 'Your code, full screen' });
    expect(dialog).toContainElement(textbox);
    expect(dialog).toHaveTextContent('2 of 3 pass');
    expect(document.documentElement).toHaveClass('editor-open');
    // Both rows show in full screen, and the Run key gives way to the header's button.
    expect(screen.getByRole('toolbar', { name: 'Suggestions' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run tests' }));
    expect(onRun).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.documentElement).not.toHaveClass('editor-open');
    expect(screen.getByRole('button', { name: 'Full screen' })).toHaveFocus();
  });

  it('keeps the task a tap away in full screen, and the header row outside it', () => {
    render(
      <CodeEditor
        value=""
        language="js"
        ariaLabel="Your code"
        header={<p>Unplugged</p>}
        task={<p>Write cartTotal.</p>}
      />,
    );
    expect(screen.getByText('Unplugged')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    // The header gives way to the full-screen one, which holds the task, closed at first.
    expect(screen.queryByText('Unplugged')).toBeNull();
    const toggle = screen.getByRole('button', { name: 'Task' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Write cartTotal.')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(toggle.getAttribute('aria-controls') ?? '')).toHaveAttribute(
      'data-open',
      'true',
    );
  });

  it('locks the lines outside an editable region and starts the caret inside it', () => {
    const starter = 'function f() {\n  // here\n}';
    render(
      <CodeEditor
        value={starter}
        language="js"
        ariaLabel="Your code"
        editableRegion={{ starter, lines: '2' }}
      />,
    );
    const editor = screen.getByTestId('code-editor');
    expect(editor.querySelectorAll('.cm-editableLine')).toHaveLength(1);
    expect(editor.querySelectorAll('.cm-lockedLine')).toHaveLength(2);
  });

  it('closes full screen on Escape', () => {
    render(<CodeEditor value="" language="js" ariaLabel="Your code" />);
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('leaves full screen when the step turns read-only', () => {
    const { rerender } = render(<CodeEditor value="" language="js" ariaLabel="Your code" />);
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    act(() => rerender(<CodeEditor value="" language="js" ariaLabel="Your code" readOnly />));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByTestId('symbol-bar')).toBeNull();
  });
});

describe('CodeEditor at a desk', () => {
  it('has no key rows and no full screen', () => {
    coarsePointer(false);
    render(<CodeEditor value="" language="js" ariaLabel="Your code" />);
    expect(screen.queryByTestId('symbol-bar')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Full screen' })).toBeNull();
  });
});
