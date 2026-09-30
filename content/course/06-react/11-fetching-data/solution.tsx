import { useEffect, useState } from 'react';

export type Weather = { summary: string; high: number };

export function Forecast({ city, load }: { city: string; load: (city: string) => Promise<Weather> }) {
  const [forecast, setForecast] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    // A new city starts from nothing, so the old city's forecast never sits under the new name.
    setForecast(null);
    setFailed(false);
    load(city)
      .then((data) => {
        if (!ignore) setForecast(data);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });
    // Runs before the next city's effect, so this request's late answer is dropped.
    return () => {
      ignore = true;
    };
  }, [city, load]);

  if (failed) return <p>Couldn't load the forecast</p>;
  if (forecast === null) return <p>Loading</p>;
  return (
    <p>
      {forecast.summary}, high of {forecast.high}°C
    </p>
  );
}
