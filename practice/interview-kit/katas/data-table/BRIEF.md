# Data table

Format: front-end live coding or take-home, 60 to 90 minutes. React and TypeScript.

## The prompt

"Show a list of orders in a table. Users sort by any column, filter by text and page
through. Product wants a link to a filtered, sorted view to be shareable, so the table's
state has to live in the URL."

## The contract

In `src/data-table.tsx`, implement three pure functions and one component.

- `parseTableState(search: string): TableState` reads a query string such as
  `?sort=total&dir=desc&q=berlin&page=2&size=25`. Anything missing or invalid falls back to
  the default: no sort, empty filter, page 1, size 10. `size` must be one of 10, 25, 50.
  `dir` is `asc` or `desc`, default `asc`.
- `serializeTableState(state): string` is the inverse. It leaves out defaults, so the
  default state serialises to an empty string, and the round trip is lossless.
- `applyTableState(rows, columns, state)` filters (case-insensitive substring over every
  column), sorts (numbers numerically, strings with `localeCompare`, stable), clamps the
  page to the last page, and returns `{ rows, total, page, pageCount }`.
- `<DataTable rows columns state onStateChange caption />` is controlled: it renders from
  `state` and reports changes through `onStateChange`, never holding its own copy.
  - A `<table>` with a `<caption>`, `<th scope="col">` headers.
  - Sortable columns hold a `<button>` in the header. The header has
    `aria-sort="ascending"` or `"descending"` when sorted by that column and no `aria-sort`
    otherwise. Clicking cycles ascending, descending, unsorted.
  - A text input labelled "Filter". Changing it sets `q` and resets `page` to 1.
  - "Previous" and "Next" buttons, disabled at the ends, and the text "Page 2 of 5".
  - When nothing matches, one row saying "No matching rows".

## Constraints

- No table library. Plain elements.

## What the interviewer looks for

- Pure state logic separated from rendering, so most tests need no DOM.
- Controlled component: the URL is the source of truth, so back and forward just work.
- `aria-sort` on the header cell, not on the button, and a real `<button>` for sorting.
- Stable sort, numeric sort for numbers, and why `sort()` without a comparator is a trap.
- Talk: server-side sorting and paging once rows reach 100,000, debouncing the filter,
  virtualisation, and keeping selection when the page changes.

Run: `pnpm kata data-table`. Reference: `pnpm kata data-table --solution`.
