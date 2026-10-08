import type { Metadata } from 'next';
import { VocabularyHome } from '@/features/vocabulary/VocabularyHome';
import type { IndexWord } from '@/features/vocabulary/types';
import { getGlossary } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Vocabulary',
  description:
    'Every word the course teaches, in plain English: search it, see where you learnt it, and learn it like a language.',
};

export default async function VocabularyPage() {
  const glossary = await getGlossary();
  const words: IndexWord[] = glossary.words.map((w) => ({
    id: w.id,
    term: w.term,
    aka: w.aka,
    short: w.short,
    area: w.area,
    level: w.level,
  }));
  return <VocabularyHome words={words} areas={glossary.areas} />;
}
