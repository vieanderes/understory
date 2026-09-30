type Props = { params: Promise<{ slug: string }> };

const recipes: Record<string, { title: string; summary: string }> = {
  'lemon-cake': { title: 'Lemon cake', summary: 'A sharp, soft sponge in one bowl.' },
  'lentil-soup': { title: 'Lentil soup', summary: 'A warming soup ready in 30 minutes.' },
};

export async function generateMetadata({ params }: Props) {
  return { title: 'Recipes' };
}
