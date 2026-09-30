import { useEffect, useState } from 'react';

export type Weather = { summary: string; high: number };

// Works for one city. It never reports a failure, and a slow answer for an old city wins.
export function Forecast({ city, load }: { city: string; load: (city: string) => Promise<Weather> }) {
  const [forecast, setForecast] = useState<Weather | null>(null);

  useEffect(() => {
    load(city).then((data) => setForecast(data));
  }, [city, load]);

  if (forecast === null) return <p>Loading</p>;
  return (
    <p>
      {forecast.summary}, high of {forecast.high}°C
    </p>
  );
}
