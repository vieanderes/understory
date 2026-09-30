import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('is a button, not a submit, unless asked', () => {
    render(<Button>Check</Button>);
    expect(screen.getByRole('button', { name: 'Check' })).toHaveAttribute('type', 'button');
  });

  it('blocks a second click while loading and says it is busy', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Check
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Check' });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});
