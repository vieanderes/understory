import { act, render, screen } from '@testing-library/react';
import { RecipeCard, show } from './solution';

test('the card is an article with the class recipe', () => {
  const { container } = render(<RecipeCard />);
  expect(container.querySelector('article')).toHaveClass('recipe');
});

test('the name is a heading', () => {
  render(<RecipeCard />);
  expect(screen.getByRole('heading', { name: 'Pancakes' })).toBeInTheDocument();
});

test('it says how many it serves and how long it takes', () => {
  render(<RecipeCard />);
  expect(screen.getByText('Serves 4')).toBeInTheDocument();
  expect(screen.getByText('Ready in 20 minutes')).toBeInTheDocument();
});

test('show puts the card inside the container', () => {
  const container = document.createElement('div');
  document.body.append(container);
  act(() => {
    show(container);
  });
  expect(container.querySelector('h2')).toHaveTextContent('Pancakes');
  container.remove();
});
