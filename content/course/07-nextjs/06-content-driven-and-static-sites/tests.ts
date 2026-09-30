import { generateMetadata } from './solution';

const forSlug = (slug: string) => generateMetadata({ params: Promise.resolve({ slug }) });

test('uses the recipe title and summary', async () => {
  const metadata = await forSlug('lemon-cake');
  expect(metadata).toEqual({
    title: 'Lemon cake',
    description: 'A sharp, soft sponge in one bowl.',
    openGraph: { images: ['/photos/lemon-cake.jpg'] },
  });
});

test('builds the picture path from the slug', async () => {
  const metadata = (await forSlug('lentil-soup')) as { openGraph?: { images?: string[] } };
  expect(metadata.openGraph?.images).toEqual(['/photos/lentil-soup.jpg']);
});

test('an unknown slug gets a plain title only', async () => {
  expect(await forSlug('toast')).toEqual({ title: 'Recipe not found' });
});
