# (d) A data dashboard

## The brief

"Operations want to see how orders are doing. We have a year of order data. They want to
filter by date range, region and status, see the numbers change, and see a chart of orders
over time. They will share links to specific views in chat. Build the API and the page."

Generate the data: 50,000 generic orders with a date, region, status, amount and customer
id, seeded so it is reproducible. SQLite or Postgres or in memory, with a reason.

## Must-haves

- An API: a list endpoint with filters, sorting and cursor pagination, and an aggregate
  endpoint (orders and revenue per day or week for the filters). Validated input and one
  error format.
- A page with filters, a summary (count, revenue, average order), a table and a line or
  bar chart. All filter state in the URL, so a shared link opens the same view.
- Loading, empty and error states. An accessible table (`aria-sort`, a caption) and a chart
  with a text alternative or a data table.
- Tests on the aggregation and the filter parsing.

## Nice-to-haves

- CSV export of the current view.
- Indexes chosen for the filters, with a query plan to show.
- Caching of aggregates and how it is invalidated.
- A comparison with the previous period.

## The rubric

| Area          | Strong                                                                                    | Weak                                               |
| ------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Scoping       | API and one filter end to end before the chart                                            | A chart library configured, with no data behind it |
| Working slice | Changing a filter updates numbers, table and chart, and the URL                           | Filters that only change the table                 |
| Code quality  | Aggregation in the database or a tested function; query parameters validated in one place | Filtering 50,000 rows in the browser               |
| Tests         | Aggregation edge cases: empty range, time zones, week boundaries                          | Snapshot tests of the chart                        |
| Evals         | Not applicable; say so                                                                    |                                                    |
| README        | The data model, the indexes, what happens at 10 million rows                              | No mention of scale                                |
| Presentation  | Opens a shared link live; explains one query and its index                                | Clicks through every filter                        |

## Questions you will be asked

- Why cursor pagination here? When is offset fine?
- Which time zone is "a day"? What did you choose, and what breaks at the boundaries?
- The table has 10 million rows. What gets slow first, and what would you do?
- Why aggregate on the server rather than in the browser?
- How would you make the chart usable without sight of it?
- Two people share a link, but one is in another time zone. Do they see the same numbers?
- How would you cache the aggregate endpoint, and when does the cache go stale?
- How would you add authentication and restrict regions per user?
- What did you use AI for, and what did you check by hand?
