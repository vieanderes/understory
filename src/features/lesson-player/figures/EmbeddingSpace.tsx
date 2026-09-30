import { cn } from '@/lib/cn';
import { Label, Marker, type Phase } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const KEY: FigureKeyItem[] = [
  {
    n: 1,
    title: 'A point',
    body: 'One text, placed by its embedding. Only the distances mean something, not the axes.',
  },
  {
    n: 2,
    title: 'A neighbourhood',
    body: 'Texts about the same thing land close together, even with no words in common.',
  },
  {
    n: 3,
    title: 'The question',
    body: 'Embedded with the same model, so it lands on the same map.',
  },
  {
    n: 4,
    title: 'Nearest neighbours',
    body: 'Search keeps the closest few, the top k. Here k is 3.',
  },
  { n: 5, title: 'Far away', body: 'Unrelated texts are far off, so they are never picked.' },
];

const STEPS: FigureStep[] = [
  {
    text: 'Each text becomes a point on a map of meaning. A real embedding has about a thousand dimensions. This map squeezes them into two.',
    focus: [1],
  },
  {
    text: 'Texts about the same thing land close together: refunds in one place, opening hours in another, delivery in a third.',
    focus: [2],
  },
  {
    text: 'A question arrives: I want my money back. It shares no words with the refund texts, but it lands right beside them.',
    focus: [3],
  },
  { text: 'Search keeps the 3 nearest points. All 3 are about refunds.', focus: [4] },
  {
    text: 'We open at 9 is far away, so it is never picked, however the question is worded.',
    focus: [5],
  },
];

type Place = 'above' | 'below' | 'right';

interface Point {
  id: string;
  text: string;
  x: number;
  y: number;
  place: Place;
}

// Laid out by hand at about 7.8 px per mono character, so no label crosses another.
const POINTS: Point[] = [
  { id: 'a', text: 'Refunds: 5 days', x: 64, y: 60, place: 'above' },
  { id: 'b', text: 'Refund to card', x: 200, y: 52, place: 'above' },
  { id: 'c', text: 'Returns: 30 days', x: 136, y: 124, place: 'right' },
  { id: 'd', text: 'We open at 9', x: 64, y: 232, place: 'below' },
  { id: 'e', text: 'Closed Sundays', x: 104, y: 276, place: 'below' },
  { id: 'f', text: 'Free delivery', x: 232, y: 220, place: 'below' },
  { id: 'g', text: 'Track a parcel', x: 256, y: 268, place: 'below' },
];

const NEAREST = new Set(['a', 'b', 'c']);
const Q = { x: 136, y: 80 };

const GROUPS = [
  { id: 'refunds', cx: 136, cy: 84, rx: 116, ry: 68, label: 'refunds', lx: 304, ly: 20 },
  { id: 'hours', cx: 84, cy: 256, rx: 72, ry: 52, label: 'hours', lx: 16, ly: 188 },
  { id: 'delivery', cx: 244, cy: 248, rx: 68, ry: 52, label: 'delivery', lx: 304, ly: 180 },
] as const;

const W = 320;
const H = 320;

function Dot({ p, phase, ring }: { p: Point; phase: Phase; ring: boolean }) {
  const at =
    p.place === 'above'
      ? { x: p.x, y: p.y - 20, anchor: 'middle' as const }
      : p.place === 'below'
        ? { x: p.x, y: p.y + 20, anchor: 'middle' as const }
        : { x: p.x + 16, y: p.y, anchor: 'start' as const };
  return (
    <g>
      <circle
        cx={p.x}
        cy={p.y}
        r={9}
        strokeWidth={2}
        className={cn(
          'stroke-fg fill-none transition-opacity duration-200 ease-out',
          ring ? 'opacity-100' : 'opacity-0',
        )}
      />
      <circle
        cx={p.x}
        cy={p.y}
        r={4}
        className={cn(
          phase === 'now' ? 'fill-fg' : phase === 'future' ? 'fill-faint' : 'fill-muted',
        )}
      />
      <Label x={at.x} y={at.y} anchor={at.anchor} phase={phase} weight={ring ? 'medium' : 'normal'}>
        {p.text}
      </Label>
    </g>
  );
}

function draw(step: number, focus: ReadonlySet<number>) {
  const searching = step >= 3;
  return (
    <>
      {/* A faint dot grid: a map, with no axes worth reading. */}
      <g aria-hidden="true" className="fill-border">
        {Array.from({ length: 9 }, (_, i) =>
          Array.from({ length: 9 }, (_, j) => (
            <circle key={`${i}-${j}`} cx={16 + i * 36} cy={16 + j * 36} r={1} />
          )),
        )}
      </g>

      {GROUPS.map((g) => (
        <g
          key={g.id}
          className={cn(
            'transition-opacity duration-200 ease-out',
            step >= 1 ? 'opacity-100' : 'opacity-0',
          )}
        >
          <ellipse
            cx={g.cx}
            cy={g.cy}
            rx={g.rx}
            ry={g.ry}
            strokeWidth={1}
            strokeDasharray="3 4"
            className={cn('fill-none', step === 1 ? 'stroke-fg' : 'stroke-faint')}
          />
          <Label
            x={g.lx}
            y={g.ly}
            anchor={g.lx > W / 2 ? 'end' : 'start'}
            phase={step === 1 ? 'now' : 'past'}
            className="t-label"
          >
            {g.label}
          </Label>
        </g>
      ))}

      {/* Lines from the question to its nearest neighbours. */}
      {POINTS.filter((p) => NEAREST.has(p.id)).map((p) => (
        <line
          key={p.id}
          x1={Q.x}
          y1={Q.y}
          x2={p.x}
          y2={p.y}
          strokeWidth={step === 3 ? 2 : 1}
          className={cn(
            'stroke-fg transition-opacity duration-200 ease-out',
            searching ? 'opacity-100' : 'opacity-0',
          )}
        />
      ))}

      {POINTS.map((p) => {
        const near = NEAREST.has(p.id);
        const phase: Phase =
          step === 0 ? 'now' : step === 3 && !near ? 'future' : step === 3 ? 'now' : 'past';
        return <Dot key={p.id} p={p} phase={phase} ring={searching && near} />;
      })}

      {/* The question: a solid ink point, a size up from the rest. */}
      <g
        className={cn(
          'transition-opacity duration-200 ease-out',
          step >= 2 ? 'opacity-100' : 'opacity-0',
        )}
      >
        <circle cx={Q.x} cy={Q.y} r={7} className="fill-fg" />
        <Label x={Q.x + 12} y={Q.y + 6} anchor="start" phase="now" weight="medium">
          question
        </Label>
      </g>

      {/* How far the unrelated text is. */}
      <g
        className={cn(
          'transition-opacity duration-200 ease-out',
          step >= 4 ? 'opacity-100' : 'opacity-0',
        )}
      >
        <line
          x1={60}
          y1={222}
          x2={Q.x - 4}
          y2={Q.y + 8}
          strokeWidth={1}
          strokeDasharray="3 4"
          className={step === 4 ? 'stroke-fg' : 'stroke-muted'}
        />
        <Label x={80} y={160} anchor="end" phase={step === 4 ? 'now' : 'past'} weight="medium">
          far
        </Label>
      </g>

      <Marker x={260} y={212} n={1} on={focus.has(1)} />
      <Marker x={156} y={244} n={2} on={focus.has(2)} />
      <Marker x={224} y={86} n={3} on={focus.has(3)} />
      <Marker x={36} y={72} n={4} on={focus.has(4)} />
      <Marker x={104} y={172} n={5} on={focus.has(5)} />
    </>
  );
}

/** Texts as points on a map of meaning, and a question finding its nearest neighbours. */
export function EmbeddingSpace() {
  return (
    <SteppedFigure
      title="Embeddings as points on a map of meaning, with a question and its nearest neighbours"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
