export interface AutocompleteProps {
  label: string;
  search: (query: string, signal: AbortSignal) => Promise<string[]>;
  debounceMs?: number;
  minChars?: number;
  onSelect?: (value: string) => void;
}

export function Autocomplete({ label }: AutocompleteProps) {
  return (
    <div>
      <label>
        {label}
        <input />
      </label>
    </div>
  );
}
