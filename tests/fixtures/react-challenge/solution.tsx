import { useId, useState } from 'react';

interface AutocompleteProps {
  label: string;
  options: string[];
  onSelect?: (value: string) => void;
}

export function Autocomplete({ label, options, onSelect }: AutocompleteProps) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const matches = options.filter((option) => option.toLowerCase().startsWith(query.toLowerCase()));
  const showList = open && matches.length > 0;

  function choose(value: string) {
    setQuery(value);
    setOpen(false);
    setActive(-1);
    onSelect?.(value);
  }

  return (
    <div>
      <label htmlFor={`${id}-input`}>{label}</label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${id}-${active}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(event.target.value !== '');
          setActive(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, matches.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === 'Enter' && showList && active >= 0) {
            event.preventDefault();
            choose(matches[active] as string);
          } else if (event.key === 'Escape') {
            setOpen(false);
            setActive(-1);
          }
        }}
      />
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label={label}>
          {matches.map((option, index) => (
            <li
              key={option}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              onClick={() => choose(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
