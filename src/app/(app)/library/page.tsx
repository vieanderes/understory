import type { Metadata } from 'next';
import { LABS } from '@/features/labs/registry';
import { LibraryIndex, SHELF_ICONS, type Shelf } from '@/features/library/LibraryIndex';
import { getManifest, getOnlineTestIndex, getPaths } from '@/lib/content';
import { listDates } from '@/lib/news';

export const metadata: Metadata = {
  title: 'Library',
  description: 'Every path, lesson, lecture, lab and coding test in Understory.',
};

export default async function LibraryPage() {
  const [manifest, paths, dates, tests] = await Promise.all([
    getManifest(),
    getPaths(),
    listDates(),
    getOnlineTestIndex(),
  ]);
  const lessons = manifest.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const shelves: Shelf[] = [
    {
      href: '/learn',
      icon: SHELF_ICONS.course,
      title: 'The course',
      note: `Every lesson, in ${manifest.parts.length} parts, with search`,
      count: `${lessons} lessons`,
    },
    {
      href: '/practise/online-test',
      icon: SHELF_ICONS.tests,
      title: 'Coding tests',
      note: 'Timed tests in an AI-assisted coding simulator',
      count: `${tests.presets.length + 1} tests · ${tests.tasks.length} tasks`,
    },
    {
      href: '/lectures',
      icon: SHELF_ICONS.lectures,
      title: 'Lectures',
      note: 'The course to read, listen to or print',
    },
    {
      href: '/labs',
      icon: SHELF_ICONS.labs,
      title: 'Labs',
      note: 'Mechanisms you step through',
      count: `${LABS.length} labs`,
    },
    {
      href: '/map',
      icon: SHELF_ICONS.map,
      title: 'Concept map',
      note: 'What you know, concept by concept',
    },
    {
      href: '/signal/archive',
      icon: SHELF_ICONS.news,
      title: 'News archive',
      note: 'Every earlier edition',
      count: `${dates.length} editions`,
    },
    {
      href: '/decisions',
      icon: SHELF_ICONS.decisions,
      title: 'Decision records',
      note: 'The decisions you wrote for your capstones',
    },
    {
      href: '/start',
      icon: SHELF_ICONS.level,
      title: 'Find your level',
      note: 'Ten questions that find where to start',
      count: '8 min',
    },
  ];
  const pathShelves: Shelf[] = paths.map((path) => ({
    href: `/paths/${path.id}`,
    icon: SHELF_ICONS.paths,
    title: path.name,
    note: path.decision ?? path.promise,
    count: `${path.lessonIds.length} lessons`,
  }));
  return <LibraryIndex shelves={shelves} paths={pathShelves} />;
}
