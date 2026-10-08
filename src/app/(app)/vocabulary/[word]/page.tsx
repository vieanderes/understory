import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WordPage } from '@/features/vocabulary/WordPage';
import { getGlossary } from '@/lib/content';

type Props = { params: Promise<{ word: string }> };

export async function generateStaticParams() {
  const { words } = await getGlossary();
  return words.map((w) => ({ word: w.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { word: id } = await params;
  const word = (await getGlossary()).words.find((w) => w.id === id);
  return word ? { title: `${word.term} · Vocabulary`, description: word.short } : {};
}

export default async function VocabularyWordPage({ params }: Props) {
  const { word: id } = await params;
  const { words, areas } = await getGlossary();
  const at = words.findIndex((w) => w.id === id);
  const word = words[at];
  if (!word) notFound();
  const sameArea = words.filter((w) => w.area === word.area);
  const i = sameArea.indexOf(word);
  const neighbour = (w: (typeof words)[number] | undefined) =>
    w ? { id: w.id, term: w.term } : undefined;
  const previous = neighbour(sameArea[i - 1]);
  const next = neighbour(sameArea[i + 1]);
  return (
    <WordPage
      word={word}
      areaTitle={areas.find((a) => a.id === word.area)?.title ?? word.area}
      names={new Map(words.map((w) => [w.id, w.term]))}
      {...(previous ? { previous } : {})}
      {...(next ? { next } : {})}
    />
  );
}
