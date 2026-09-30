import { cn } from '@/lib/cn';
import { Arrow, Box, Label, Marker, Token, type Phase, type Point } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const KEY: FigureKeyItem[] = [
  { n: 1, title: 'Client', body: 'The side that asks. Here, your browser.' },
  {
    n: 2,
    title: 'Server',
    body: 'A program on another computer that waits for requests and answers them.',
  },
  {
    n: 3,
    title: 'Method and path',
    body: 'What to do, and to which thing: POST sends something new.',
  },
  { n: 4, title: 'Headers', body: 'Labels about the message, such as what format the body is in.' },
  { n: 5, title: 'Body', body: 'The data itself. A GET usually has none.' },
  { n: 6, title: 'Status code', body: 'How it went, as a number. 2xx means it worked.' },
];

const STEPS: FigureStep[] = [
  {
    text: 'The browser is the client. It has something to send: a new review of book 12.',
    focus: [1],
  },
  { text: 'It writes a request: a method and a path, headers, and a body.', focus: [3, 4, 5] },
  { text: 'The request travels to the server.', focus: [2] },
  {
    text: 'The server saves the review and writes a response: a status code, headers and a body.',
    focus: [6],
  },
  {
    text: 'The response travels back. 201 means created, so the page can show the new review.',
    focus: [1],
  },
];

const W = 320;
const H = 424;
const WIRE = 52;

const AT: Point[] = [
  [72, WIRE],
  [72, WIRE],
  [248, WIRE],
  [248, WIRE],
  [72, WIRE],
];

function Card({
  y,
  title,
  lines,
  phase,
}: {
  y: number;
  title: string;
  lines: readonly string[];
  phase: Phase;
}) {
  const h = 32 + lines.length * 24;
  return (
    <g>
      <Box x={16} y={y} w={288} h={h} phase={phase} radius={8} />
      <Label x={32} y={y + 18} anchor="start" phase="past" className="t-label">
        {title}
      </Label>
      {lines.map((line, i) => (
        <text
          key={i}
          x={32}
          y={y + 42 + i * 24}
          dominantBaseline="central"
          xmlSpace="preserve"
          className={cn(
            'font-mono text-sm transition-opacity duration-200 ease-out',
            phase === 'future' ? 'fill-faint' : phase === 'now' ? 'fill-fg' : 'fill-muted',
            i === 0 && 'font-medium',
          )}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

function draw(step: number, focus: ReadonlySet<number>) {
  const request: Phase = step === 1 || step === 2 ? 'now' : step > 2 ? 'past' : 'future';
  const response: Phase = step >= 3 ? 'now' : 'future';
  const outbound = step >= 2;
  const inbound = step >= 4;
  return (
    <>
      <Box
        x={16}
        y={32}
        w={112}
        h={40}
        phase={step === 0 || step === 4 ? 'now' : 'past'}
        label="browser"
      />
      <Box
        x={192}
        y={32}
        w={112}
        h={40}
        phase={step === 2 || step === 3 ? 'now' : 'past'}
        label="server"
      />

      {/* Two lanes on one wire: requests go right above it, responses come back below. */}
      <Arrow
        points={[
          [128, WIRE - 6],
          [190, WIRE - 6],
        ]}
        phase={outbound ? (step === 2 ? 'now' : 'past') : 'future'}
      />
      <Arrow
        points={[
          [192, WIRE + 6],
          [130, WIRE + 6],
        ]}
        phase={inbound ? 'now' : 'future'}
      />
      <Label x={160} y={16} phase={outbound ? 'past' : 'future'}>
        request
      </Label>
      <Label x={160} y={88} phase={inbound ? 'past' : 'future'}>
        response
      </Label>

      <Card
        y={112}
        title="request"
        phase={request}
        lines={['POST /reviews', 'Content-Type: application/json', '', '{"book":12,"stars":5}']}
      />
      <Card
        y={272}
        title="response"
        phase={response}
        lines={['201 Created', 'Content-Type: application/json', '', '{"id":88}']}
      />

      <Token at={AT[step]!} visible={step === 2 || step === 4} />

      <Marker x={16} y={52} n={1} on={focus.has(1)} />
      <Marker x={304} y={52} n={2} on={focus.has(2)} />
      <Marker x={16} y={154} n={3} on={focus.has(3)} />
      <Marker x={16} y={178} n={4} on={focus.has(4)} />
      <Marker x={16} y={226} n={5} on={focus.has(5)} />
      <Marker x={16} y={314} n={6} on={focus.has(6)} />
    </>
  );
}

/** One request out and one response back, with the parts of each message named. */
export function RequestResponse() {
  return (
    <SteppedFigure
      title="A request from the browser to a server, and the response that comes back"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
