import { Arrow, Box, Label, Marker, phaseAt, type Phase } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const KEY: FigureKeyItem[] = [
  { n: 1, title: 'Question', body: 'What the user asked, as plain text.' },
  {
    n: 2,
    title: 'Embed',
    body: 'The same embedding model that indexed the documents turns it into a vector.',
  },
  {
    n: 3,
    title: 'Search',
    body: 'Every chunk was embedded once, ahead of time. Each one gets a similarity score.',
  },
  { n: 4, title: 'Top k', body: 'Keep the best few. Here k is 3. The rest never reach the model.' },
  {
    n: 5,
    title: 'Prompt with sources',
    body: 'Each kept chunk is numbered, with a rule: answer only from these.',
  },
  {
    n: 6,
    title: 'Answer with citations',
    body: 'The reply names its sources, so code can check them.',
  },
];

const STEPS: FigureStep[] = [
  { text: 'A question comes in: how long do refunds take?', focus: [1] },
  {
    text: 'The embedding model turns the question into a vector, a list of numbers that places it by meaning.',
    focus: [2],
  },
  {
    text: 'Vector search scores the question against every stored chunk. Chunks about refunds score highest.',
    focus: [3],
  },
  {
    text: 'The top 3 chunks are kept. The gift card chunk scored well too, but it missed the cut.',
    focus: [4],
  },
  {
    text: 'The prompt numbers the 3 chunks as sources and asks the question again, under a rule: answer only from the sources.',
    focus: [5],
  },
  {
    text: 'The model answers and cites source 1. Code can check that source 1 was in the prompt.',
    focus: [6],
  },
];

const CHUNKS = [
  { text: 'Refunds: 5 working days', score: 0.91, rank: 1 },
  { text: 'Returns within 30 days', score: 0.84, rank: 3 },
  { text: 'Open 9 to 5, Mon to Sat', score: 0.12, rank: 0 },
  { text: 'Refunds go to your card', score: 0.88, rank: 2 },
  { text: 'Free delivery over £40', score: 0.21, rank: 0 },
  { text: 'Gift cards: no refunds', score: 0.79, rank: 0 },
] as const;

const KEPT = [...CHUNKS].filter((c) => c.rank > 0).sort((a, b) => a.rank - b.rank);

// A fixed shape for the question's vector: sixteen values drawn as bars about a midline.
const VECTOR = [
  0.6, -0.3, 0.9, 0.2, -0.7, 0.4, 0.1, -0.5, 0.8, -0.2, 0.3, -0.9, 0.5, 0.7, -0.4, 0.2,
];

const W = 320;
const H = 512;
const ROW0 = 188;
const ROW_H = 20;

function draw(step: number, focus: ReadonlySet<number>) {
  const q = phaseAt(step, 0);
  const embed = phaseAt(step, 1);
  const search = phaseAt(step, 2);
  const prompt = phaseAt(step, 4);
  const answer = phaseAt(step, 5);

  const chunkPhase = (rank: number): Phase => {
    if (step < 2) return 'past';
    if (step === 2) return 'now';
    return rank > 0 ? (step === 3 ? 'now' : 'past') : 'future';
  };

  return (
    <>
      <Box x={16} y={16} w={288} h={40} phase={q} label="How long do refunds take?" />
      <Arrow
        points={[
          [72, 56],
          [72, 80],
        ]}
        phase={embed}
      />

      <Box x={16} y={80} w={112} h={40} phase={embed} label="embed" />
      <Arrow
        points={[
          [128, 100],
          [148, 100],
        ]}
        phase={embed}
      />
      <g aria-hidden="true">
        {VECTOR.map((v, i) => {
          const h = Math.abs(v) * 16;
          return (
            <rect
              key={i}
              x={156 + i * 9}
              y={v > 0 ? 100 - h : 100}
              width={6}
              height={Math.max(h, 1)}
              rx={1}
              className={
                embed === 'future' ? 'fill-border' : embed === 'now' ? 'fill-fg' : 'fill-muted'
              }
            />
          );
        })}
      </g>
      <Arrow
        points={[
          [228, 124],
          [228, 148],
        ]}
        phase={search}
      />

      {/* The store: every chunk, embedded ahead of time. */}
      <Box x={16} y={148} w={288} h={168} phase={search === 'now' ? 'now' : 'past'} radius={8} />
      <Label x={32} y={168} anchor="start" phase="past" className="t-label">
        vector store
      </Label>
      <Label x={288} y={168} anchor="end" phase={step >= 2 ? 'past' : 'hidden'} className="t-label">
        score
      </Label>
      {CHUNKS.map((c, i) => {
        const y = ROW0 + i * ROW_H;
        const phase = chunkPhase(c.rank);
        const scored = step >= 2;
        return (
          <g key={c.text}>
            <Label
              x={32}
              y={y + 8}
              anchor="start"
              phase={phase}
              weight={phase === 'now' && step === 3 ? 'medium' : 'normal'}
            >
              {c.text}
            </Label>
            <rect
              x={232}
              y={y + 5}
              width={Math.max(c.score * 56, 1)}
              height={6}
              rx={1}
              className={
                phase === 'future' ? 'fill-border' : phase === 'now' ? 'fill-fg' : 'fill-muted'
              }
              opacity={scored ? 1 : 0}
              style={{ transition: 'opacity 200ms var(--ease-out)' }}
            />
          </g>
        );
      })}
      <Arrow
        points={[
          [160, 316],
          [160, 340],
        ]}
        phase={prompt}
      />

      <Box x={16} y={340} w={288} h={104} phase={prompt} />
      <Label x={32} y={358} anchor="start" phase="past" className="t-label">
        prompt
      </Label>
      {KEPT.map((c, i) => (
        <Label
          key={c.text}
          x={32}
          y={380 + i * 18}
          anchor="start"
          phase={step >= 4 ? prompt : 'future'}
        >
          {`[${i + 1}] ${c.text}`}
        </Label>
      ))}
      <Label x={32} y={434} anchor="start" phase={step >= 4 ? prompt : 'future'}>
        Q: How long do refunds take?
      </Label>
      <Arrow
        points={[
          [160, 444],
          [160, 464],
        ]}
        phase={answer}
      />

      <Box x={16} y={464} w={288} h={40} phase={answer} ink label="5 working days. [1]" />

      <Marker x={16} y={36} n={1} on={focus.has(1)} />
      <Marker x={16} y={100} n={2} on={focus.has(2)} />
      <Marker x={16} y={168} n={3} on={focus.has(3)} />
      <Marker x={304} y={ROW0 + 8} n={4} on={focus.has(4)} />
      <Marker x={16} y={358} n={5} on={focus.has(5)} />
      <Marker x={16} y={484} n={6} on={focus.has(6)} />
    </>
  );
}

/** Retrieval-augmented generation, stage by stage, with one question carried all the way through. */
export function RagPipeline() {
  return (
    <SteppedFigure
      title="The RAG pipeline: a question is embedded, searched, and answered from numbered sources"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
