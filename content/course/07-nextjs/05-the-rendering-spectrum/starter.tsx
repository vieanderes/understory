type Props = { searchParams: Promise<{ q?: string }> };

const films = ['The Sea Beast', 'Seabiscuit', 'Paddington', 'Finding Nemo'];

export default async function FilmsPage({ searchParams }: Props) {
  return <h1>All films</h1>;
}
