import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';

export interface AutocompleteProps {
  label: string;
  search: (query: string, signal: AbortSignal) => Promise<string[]>;
  debounceMs?: number;
  minChars?: number;
  onSelect?: (value: string) => void;
}

type Status = 'idle' | 'loading' | 'done' | 'error';

export function Autocomplete({
  label,
  search,
  debounceMs = 250,
  minChars = 1,
  onSelect,
}: AutocompleteProps) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Timer and request live in refs: they are not rendered, and changing them must not
  // cause a render.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const request = useRef<AbortController | undefined>(undefined);

  function cancelPending() {
    clearTimeout(timer.current);
    request.current?.abort();
  }

  useEffect(() => cancelPending, []);

  function runSearch(q: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus('loading');
    setOpen(true);
    setActive(-1);
    search(q, controller.signal).then(
      (items) => {
        // Checking the signal as well as aborting covers a search that ignores it:
        // a stale response is dropped either way.
        if (controller.signal.aborted) return;
        setResults(items);
        setStatus('done');
      },
      () => {
        if (controller.signal.aborted) return;
        setResults([]);
        setStatus('error');
      },
    );
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setQuery(value);
    cancelPending();
    const trimmed = value.trim();
    if (trimmed.length < minChars) {
      setResults([]);
      setStatus('idle');
      setOpen(false);
      setActive(-1);
      return;
    }
    timer.current = setTimeout(() => runSearch(trimmed), debounceMs);
  }

  function select(value: string) {
    cancelPending();
    setQuery(value);
    setOpen(false);
    setActive(-1);
    onSelect?.(value);
  }

  const listVisible = open && status === 'done' && results.length > 0;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = results.length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (status !== 'done' || count === 0) return;
        event.preventDefault();
        setOpen(true);
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActive((current) => {
          if (current === -1) return step === 1 ? 0 : count - 1;
          return (current + step + count) % count;
        });
        return;
      }
      case 'Enter':
        if (listVisible && active >= 0) {
          event.preventDefault();
          select(results[active]!);
        }
        return;
      case 'Escape':
        setOpen(false);
        setActive(-1);
        return;
    }
  }

  let message = '';
  if (status === 'loading') message = 'Searching';
  else if (status === 'done' && open && results.length === 0) message = 'No results';
  else if (listVisible) message = `${results.length} results`;

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={listVisible}
        aria-controls={listId}
        aria-activedescendant={listVisible && active >= 0 ? optionId(active) : undefined}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
      />
      {/* Always rendered, so aria-controls never points at a missing element. */}
      <ul id={listId} role="listbox" aria-label={label} hidden={!listVisible}>
        {results.map((result, index) => (
          <li
            key={result}
            id={optionId(index)}
            role="option"
            aria-selected={index === active}
            // Prevent the input's blur, which would close the list before the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => select(result)}
          >
            {result}
          </li>
        ))}
      </ul>
      <div role="status" aria-live="polite">
        {message}
      </div>
      {status === 'error' && (
        <div role="alert">
          Search failed.{' '}
          <button type="button" onClick={() => runSearch(query.trim())}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
