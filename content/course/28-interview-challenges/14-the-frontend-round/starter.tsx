import { useState } from 'react';

type Props = {
  search: (query: string) => Promise<string[]>;
};

// A bare input for now. Make it a combobox that searches as you type and works from the keyboard.
export function Autocomplete({ search }: Props) {
  const [query, setQuery] = useState('');

  return (
    <label>
      Search
      <input value={query} onChange={(event) => setQuery(event.target.value)} />
    </label>
  );
}
