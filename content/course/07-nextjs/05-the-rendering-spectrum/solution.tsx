type Props = { searchParams: Promise<{ q?: string }> };

const films = ['The Sea Beast', 'Seabiscuit', 'Paddington', 'Finding Nemo'];

export default async function FilmsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const shown = q ? films.filter((title) => title.toLowerCase().includes(q.toLowerCase())) : films;
  return (
    <main>
      <h1>{q ? `Results for "${q}"` : 'All films'}</h1>
      <ul>
        {shown.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </main>
  );
}
