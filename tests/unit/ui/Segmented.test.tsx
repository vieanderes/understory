import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Segmented } from '@/components/ui/Segmented';

const OPTIONS = [
  { value: 'guess', label: 'Guess' },
  { value: 'fairly', label: 'Fairly' },
  { value: 'certain', label: 'Certain' },
] as const;

describe('Segmented', () => {
  it('is a labelled radio group with nothing chosen by default', () => {
    render(<Segmented label="How sure" options={OPTIONS} value={null} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'How sure' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true);
  });

  it('reports the picked value', async () => {
    const onChange = vi.fn();
    render(<Segmented label="How sure" options={OPTIONS} value="guess" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Certain' }));
    expect(onChange).toHaveBeenCalledWith('certain');
  });
});
