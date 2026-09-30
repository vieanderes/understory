# Autocomplete

Format: front-end live coding, 60 minutes. React and TypeScript. The most common front-end
practical task; the interviewer adds requirements as you finish each one.

## The prompt

"Build a search box that suggests results as you type. The search function is async and
sometimes slow. Make it pleasant for keyboard and screen reader users."

## The contract

Implement `<Autocomplete label search debounceMs? minChars? onSelect? />` in
`src/autocomplete.tsx`.

- `search(query, signal)` returns `Promise<string[]>`. Call it with the trimmed query only
  after `debounceMs` (default 250) with no typing, and only when the query has at least
  `minChars` (default 1) characters.
- Latest response wins. When the user types again, abort the previous request through the
  signal, and ignore its result even if it resolves anyway.
- The ARIA combobox pattern (WAI-ARIA Authoring Practices, list autocomplete):
  - the input has `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, and
    `aria-controls` pointing at a `role="listbox"` element that is always in the DOM;
  - options have `role="option"`, a unique `id` and `aria-selected`;
  - focus stays in the input; the active option is announced with
    `aria-activedescendant`.
- Keys: ArrowDown and ArrowUp move the active option and wrap; Enter picks the active
  option; Escape closes the list.
- Picking an option (Enter or click) puts it in the input, closes the list and calls
  `onSelect`.
- States in a `role="status"` region: "Searching" while loading, "No results" when the
  search returned nothing. On failure, a `role="alert"` with "Search failed" and a
  "Try again" button that repeats the search.

## Constraints

- No libraries beyond React. Plain elements, no styling required.

## What the interviewer looks for

- Debounce with a cleared timer, not a new closure per keystroke that all fire.
- The race: why a slow first response must not overwrite a fast second one, and two ways
  to stop it (abort, or a request id).
- The listbox existing before it has content, so `aria-controls` never points at nothing.
- `onMouseDown` preventing blur on option click, or the list closes before the click lands.
- Talk: caching results per query, highlighting the match, virtualising 10,000 options,
  and what changes when results come from a server component.

Run: `pnpm kata autocomplete`. Reference: `pnpm kata autocomplete --solution`.
