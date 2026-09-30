import { render, screen } from '@testing-library/react';
import { InboxCard } from './solution';

test('shows the title as a heading', () => {
  render(
    <InboxCard title="Team chat" unread={2}>
      <p>Lunch at one?</p>
    </InboxCard>,
  );
  expect(screen.getByRole('heading', { name: 'Team chat' })).toBeInTheDocument();
});

test('shows the children under the heading', () => {
  render(
    <InboxCard title="Team chat" unread={2}>
      <p>Lunch at one?</p>
    </InboxCard>,
  );
  expect(screen.getByText('Lunch at one?')).toBeInTheDocument();
});

test('shows the unread count in the badge', () => {
  const { container } = render(
    <InboxCard title="Team chat" unread={3}>
      <p>Lunch at one?</p>
    </InboxCard>,
  );
  expect(container.querySelector('.badge')).toHaveTextContent('3');
});

test('at 0 there is no badge and no stray 0', () => {
  const { container } = render(
    <InboxCard title="Family" unread={0}>
      <p>All caught up</p>
    </InboxCard>,
  );
  expect(container.querySelector('.badge')).toBeNull();
  expect(container).toHaveTextContent(/^FamilyAll caught up$/);
});

test('above 9 the badge says 9+', () => {
  const { container } = render(
    <InboxCard title="News" unread={12}>
      <p>Twelve new stories</p>
    </InboxCard>,
  );
  expect(container.querySelector('.badge')).toHaveTextContent('9+');
});
