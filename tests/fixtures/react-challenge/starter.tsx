import { useState } from 'react';

interface AutocompleteProps {
  label: string;
  options: string[];
  onSelect?: (value: string) => void;
}

// Show the matching options as the learner types, and let the arrow keys and Enter pick one.
export function Autocomplete({ label }: AutocompleteProps) {
  const [query, setQuery] = useState('');

  return (
    <div>
      <label>
        {label}
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
    </div>
  );
}
