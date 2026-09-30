import { render, screen } from '@testing-library/react';
import { Forecast } from './solution';
import type { Weather } from './solution';

// A promise the test settles by hand, so it decides when each answer arrives.
function later() {
  let resolve: (value: Weather) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<Weather>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const settle = () => new Promise((done) => setTimeout(done, 0));

test('shows Loading, then the forecast', async () => {
  const answer = later();
  render(<Forecast city="Leeds" load={() => answer.promise} />);
  expect(screen.getByText('Loading')).toBeInTheDocument();
  answer.resolve({ summary: 'Showers', high: 14 });
  expect(await screen.findByText('Showers, high of 14°C')).toBeInTheDocument();
});

test('asks for the city it is given, and again when it changes', async () => {
  const asked: string[] = [];
  const load = (city: string) => {
    asked.push(city);
    return Promise.resolve({ summary: 'Sunny', high: 20 });
  };
  const { rerender } = render(<Forecast city="Leeds" load={load} />);
  await screen.findByText('Sunny, high of 20°C');
  rerender(<Forecast city="York" load={load} />);
  await screen.findByText('Sunny, high of 20°C');
  expect(asked).toEqual(['Leeds', 'York']);
});

test('says so when loading fails', async () => {
  const answer = later();
  render(<Forecast city="Leeds" load={() => answer.promise} />);
  answer.reject(new Error('Server error'));
  expect(await screen.findByText("Couldn't load the forecast")).toBeInTheDocument();
  expect(screen.queryByText('Loading')).not.toBeInTheDocument();
});

test('shows Loading again when the city changes', async () => {
  const answers: Record<string, ReturnType<typeof later>> = { Leeds: later(), York: later() };
  const load = (city: string) => answers[city]!.promise;
  const { rerender } = render(<Forecast city="Leeds" load={load} />);
  answers.Leeds!.resolve({ summary: 'Showers', high: 14 });
  await screen.findByText('Showers, high of 14°C');
  rerender(<Forecast city="York" load={load} />);
  await settle();
  expect(screen.getByText('Loading')).toBeInTheDocument();
  expect(screen.queryByText('Showers, high of 14°C')).not.toBeInTheDocument();
});

test('ignores a late answer for the old city', async () => {
  const answers: Record<string, ReturnType<typeof later>> = { Leeds: later(), York: later() };
  const load = (city: string) => answers[city]!.promise;
  const { rerender } = render(<Forecast city="Leeds" load={load} />);
  rerender(<Forecast city="York" load={load} />);
  answers.York!.resolve({ summary: 'Sunny', high: 18 });
  await screen.findByText('Sunny, high of 18°C');
  answers.Leeds!.resolve({ summary: 'Showers', high: 14 });
  await settle();
  expect(screen.getByText('Sunny, high of 18°C')).toBeInTheDocument();
  expect(screen.queryByText('Showers, high of 14°C')).not.toBeInTheDocument();
});
