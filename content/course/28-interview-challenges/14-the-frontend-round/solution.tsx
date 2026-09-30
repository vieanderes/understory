import { useId, useRef, useState } from 'react';

type Props = {
  search: (query: string) => Promise<string[]>;
};

type Status = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export function Autocomplete({ search }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  // The id of the latest request. A ref, because changing it must not render anything.
  const latest = useRef(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [results, setResults] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const open = status === 'success';

  function close() {
    // Closing also makes every answer still in flight stale.
    latest.current += 1;
    setStatus('idle');
    setResults([]);
    setActive(-1);
  }

  async function lookUp(text: string) {
    latest.current += 1;
    const requestId = latest.current;
    setStatus('loading');
    setActive(-1);
    try {
      const found = await search(text);
      if (requestId !== latest.current) return;
      setResults(found);
      setStatus(found.length === 0 ? 'empty' : 'success');
    } catch {
      if (requestId !== latest.current) return;
      setResults([]);
      setStatus('error');
    }
  }

  function choose(option: string) {
    setQuery(option);
    close();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (!open) return;
    const count = results.length;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((active + 1) % count);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active <= 0 ? count - 1 : active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(results[active] as string);
    }
  }

  let message = '';
  if (status === 'loading') message = 'Loading';
  if (status === 'empty') message = 'No results';

  return (
    <div>
      <label htmlFor={`${id}-input`}>Search</label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        value={query}
        onChange={(event) => {
          const text = event.target.value;
          setQuery(text);
          if (text.trim() === '') close();
          else lookUp(text);
        }}
        onKeyDown={onKeyDown}
      />
      <p role="status">{message}</p>
      {status === 'error' && <p role="alert">Search failed</p>}
      {open && (
        <ul id={listId} role="listbox" aria-label="Results">
          {results.map((option, index) => (
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
