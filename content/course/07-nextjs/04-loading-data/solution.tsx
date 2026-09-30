type Day = { day: string; high: number };
type Props = { params: Promise<{ city: string }> };

export default async function ForecastPage({ params }: Props) {
  const { city } = await params;
  const response = await fetch(`https://api.weather.example/forecast?city=${city}`);
  if (!response.ok) {
    return <p>No forecast for {city}</p>;
  }
  const data: { days: Day[] } = await response.json();
  return (
    <main>
      <h1>{city}</h1>
      <ul>
        {data.days.map((d) => (
          <li key={d.day}>
            {d.day}: {d.high}°C
          </li>
        ))}
      </ul>
    </main>
  );
}
