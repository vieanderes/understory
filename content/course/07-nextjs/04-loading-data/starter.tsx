type Props = { params: Promise<{ city: string }> };

export default async function ForecastPage({ params }: Props) {
  return <h1>Forecast</h1>;
}
