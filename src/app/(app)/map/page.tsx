import type { Metadata } from 'next';
import { MapView, type MapModule, type MapPart } from '@/features/map/MapView';
import { getManifest, getModules } from '@/lib/content';
import { Title } from '@/features/motion/Title';
import { PageHead } from '@/components/layout/PageHead';
import { CELL_STYLE, LEGEND, STATE_LABEL, STATE_NOTE, STATE_STYLE } from '@/features/map/states';
import { cn } from '@/lib/cn';

export const metadata: Metadata = {
  title: 'Map',
  description: 'Every concept in the course, and how well you hold each one today.',
};

export default async function MapPage() {
  const modules: MapModule[] = (await getModules()).map((m) => ({
    id: m.id,
    number: m.number,
    title: m.title,
    concepts: m.concepts.map(({ id, title, summary }) => ({ id, title, summary })),
  }));
  const total = modules.reduce((n, m) => n + m.concepts.length, 0);
  const parts: MapPart[] = (await getManifest()).parts.map(({ id, title, summary, modules }) => ({
    id,
    title,
    summary,
    modules,
  }));

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHead
        label="Map"
        title={
          <Title>
            <span className="t-figure">{total}</span> concepts.{' '}
            <span className="text-muted">Weight is what you hold.</span>
          </Title>
        }
        lede="Memory fades, so this page fades with it. The accent marks a gap: something you held and are losing. Practice brings it back."
        aside={
          <div className="flex flex-col">
            <p className="t-label pb-1 md:pb-1">How to read it</p>
            <ul
              aria-label="How state is shown"
              className="flex flex-wrap gap-x-3 gap-y-1 md:flex-col md:gap-0"
            >
              {LEGEND.map((state) => (
                <li
                  key={state}
                  className="md:border-border flex items-center gap-1 md:min-h-5 md:gap-2 md:border-t md:py-0.5"
                >
                  <span aria-hidden className={cn('size-1 shrink-0', CELL_STYLE[state])} />
                  <span className={cn('text-sm md:w-12 md:shrink-0', STATE_STYLE[state])}>
                    {STATE_LABEL[state]}
                  </span>
                  <span className="text-muted hidden min-w-0 text-sm md:inline">
                    {STATE_NOTE[state]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        }
      />
      <MapView modules={modules} parts={parts} />
    </div>
  );
}
