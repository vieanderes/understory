import { createRoot } from 'react-dom/client';

const recipe = { name: 'Pancakes', serves: 4, minutes: 20 };

export function RecipeCard() {
  return (
    <article className="recipe">
      <h2>{recipe.name}</h2>
      <p>Serves {recipe.serves}</p>
      <p>Ready in {recipe.minutes} minutes</p>
    </article>
  );
}

export function show(container: HTMLElement) {
  const root = createRoot(container);
  root.render(<RecipeCard />);
}
