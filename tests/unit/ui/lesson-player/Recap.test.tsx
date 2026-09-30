import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Recap } from '@/features/lesson-player/parts/Recap';
import { rich } from './fixtures';

describe('Recap', () => {
  it('lists what the learner can now do under one heading', () => {
    render(<Recap lines={[rich('Make a list.'), rich('Add to it.'), rich('Read one item.')]} />);
    const section = screen.getByRole('region', { name: 'You can now' });
    expect(
      within(section)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Make a list.', 'Add to it.', 'Read one item.']);
  });
});
