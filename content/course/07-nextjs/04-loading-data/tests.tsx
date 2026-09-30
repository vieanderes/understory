import { render, screen } from '@testing-library/react';
import * as file from './solution';

type Props = { params: Promise<{ city: string }> };
const ForecastPage = (file as { default?: (props: Props) => Promise<React.ReactNode> }).default;

const asked: string[] = [];

// A stand-in weather service: it knows Leeds and Oban, and answers 404 for anything else.
function fakeFetch(url: string) {
  asked.push(url);
  const city = url.split('city=')[1] ?? null;
  const days: Record<string, { day: string; high: number }[]> = {
    Leeds: [
      { day: 'Mon', high: 14 },
      { day: 'Tue', high: 11 },
    ],
    Oban: [{ day: 'Mon', high: 9 }],
  };
  const found = city !== null ? days[city] : undefined;
  return Promise.resolve({
    ok: found !== undefined,
    status: found === undefined ? 404 : 200,
    json: () => Promise.resolve(found === undefined ? { error: 'Unknown city' } : { days: found }),
  });
}

async function show(city: string) {
  if (!ForecastPage) throw new Error('Export the page with `export default`.');
  const original = globalThis.fetch;
  (globalThis as { fetch: unknown }).fetch = fakeFetch;
  try {
    render(<>{await ForecastPage({ params: Promise.resolve({ city }) })}</>);
  } finally {
    globalThis.fetch = original;
  }
}

test('asks the service for the city from the URL', async () => {
  asked.length = 0;
  await show('Leeds');
  expect(asked).toEqual(['https://api.weather.example/forecast?city=Leeds']);
});

test('shows the city and one item per day', async () => {
  await show('Leeds');
  expect(screen.getByRole('heading', { name: 'Leeds' })).toBeInTheDocument();
  const items = screen.getAllByRole('listitem').map((item) => item.textContent);
  expect(items).toEqual(['Mon: 14°C', 'Tue: 11°C']);
});

test('works for another city', async () => {
  await show('Oban');
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Mon: 9°C']);
});

test('says so when the service has no forecast', async () => {
  await show('Atlantis');
  expect(screen.getByText('No forecast for Atlantis')).toBeInTheDocument();
  expect(screen.queryByRole('list')).toBeNull();
});
