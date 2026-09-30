import { render, screen } from '@testing-library/react';
import { Receipt } from './receipt.solution';

const totals = () => screen.getAllByText(/^Total:/).map((line) => line.textContent);

test('shows the total of its prices', () => {
  render(<Receipt table={4} prices={[4.5, 3]} />);
  expect(screen.getByRole('heading', { name: 'Table 4' })).toBeInTheDocument();
  expect(totals()).toEqual(['Total: £7.50']);
});

test('two receipts on one page each show their own total', () => {
  render(
    <div>
      <Receipt table={1} prices={[4.5, 3]} />
      <Receipt table={2} prices={[10]} />
    </div>,
  );
  expect(totals()).toEqual(['Total: £7.50', 'Total: £10.00']);
});

test('rendering again with the same prices shows the same total', () => {
  const prices = [2.25, 6];
  const { rerender } = render(<Receipt table={7} prices={prices} />);
  rerender(<Receipt table={7} prices={prices} />);
  rerender(<Receipt table={7} prices={prices} />);
  expect(totals()).toEqual(['Total: £8.25']);
});

test('no prices means a total of zero', () => {
  render(<Receipt table={9} prices={[]} />);
  expect(totals()).toEqual(['Total: £0.00']);
});
