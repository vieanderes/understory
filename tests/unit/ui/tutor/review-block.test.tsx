import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReviewBlock } from '@/features/tutor/ReviewBlock';

describe('ReviewBlock', () => {
  it('lists each note with its tag and the learner’s words, then the next step', () => {
    render(
      <ReviewBlock
        body={JSON.stringify({
          notes: [
            { tag: 'keep', quote: 'new Set()', note: 'Constant lookups.' },
            { tag: 'missing', note: 'No empty list.' },
          ],
          next: 'Handle the empty list.',
        })}
      />,
    );
    const notes = within(screen.getByRole('list', { name: 'Notes on your work' })).getAllByRole(
      'listitem',
    );
    expect(notes[0]).toHaveTextContent('Keep“new Set()”Constant lookups.');
    expect(notes[1]).toHaveTextContent('MissingNo empty list.');
    expect(screen.getByText('Next: Handle the empty list.')).toBeInTheDocument();
  });

  it('draws nothing for a broken block', () => {
    const { container } = render(<ReviewBlock body="{}" />);
    expect(container).toBeEmptyDOMElement();
  });
});
