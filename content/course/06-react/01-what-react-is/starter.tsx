const recipe = { name: 'Pancakes', serves: 4, minutes: 20 };

// Describe the recipe card with JSX, reading each value from `recipe`.
export function RecipeCard() {
  return <article>{recipe.name}</article>;
}

// Make a root in `container`, then render <RecipeCard /> into it.
export function show(container: HTMLElement) {
}
