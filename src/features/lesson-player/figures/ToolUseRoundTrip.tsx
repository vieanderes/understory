import { Arrow, Box, Label, Marker, Token, phaseAt, type Point } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const KEY: FigureKeyItem[] = [
  {
    n: 1,
    title: 'Request with tools',
    body: 'The question, plus a name, a description and a schema for each tool.',
  },
  {
    n: 2,
    title: 'tool_use',
    body: 'The model stops and asks for a tool by name, with arguments and an id.',
  },
  { n: 3, title: 'Run it', body: 'Your code checks the arguments, then calls the real function.' },
  {
    n: 4,
    title: 'tool_result',
    body: 'The result goes back with the same id, after the assistant turn.',
  },
  { n: 5, title: 'Answer', body: 'Now the model has the fact, and replies in text.' },
];

const STEPS: FigureStep[] = [
  {
    text: 'Your code sends the question with tools. The model can read about check_stock, but not run it.',
    focus: [1],
  },
  {
    text: 'The model replies with stop reason tool_use: call check_stock with product "blue mug", id toolu_01.',
    focus: [2],
  },
  { text: 'Your code checks the arguments and runs the real function. It returns 4.', focus: [3] },
  {
    text: 'Your code adds the model reply to messages, then a tool_result for toolu_01, and calls the model again.',
    focus: [4],
  },
  { text: 'The model answers in text, from the result: yes, 4 are left.', focus: [5] },
];

const W = 320;
const H = 376;
const CODE = 64;
const MODEL = 256;

// Where the message is at each step: the far end of the arrow it just travelled.
const TRAVEL: Point[] = [
  [MODEL - 8, 104],
  [CODE + 8, 172],
  [CODE, 212],
  [MODEL - 8, 288],
  [CODE + 8, 344],
];

function Message({
  y,
  from,
  to,
  label,
  sub,
  step,
  at,
  n,
  on,
}: {
  y: number;
  from: number;
  to: number;
  label: string;
  sub?: string;
  step: number;
  at: number;
  n: number;
  on: boolean;
}) {
  const phase = phaseAt(step, at);
  const toward = from < to ? -1 : 1;
  const top = sub ? y - 40 : y - 20;
  return (
    <g>
      <Label x={160} y={top + 4} phase={phase} weight={phase === 'now' ? 'medium' : 'normal'}>
        {label}
      </Label>
      {sub ? (
        <Label x={160} y={top + 22} phase={phase === 'now' ? 'past' : phase}>
          {sub}
        </Label>
      ) : null}
      <Arrow
        points={[
          [from, y],
          [to + toward * 2, y],
        ]}
        phase={phase}
      />
      <Marker x={160} y={y} n={n} on={on} />
    </g>
  );
}

function draw(step: number, focus: ReadonlySet<number>) {
  const running = phaseAt(step, 2);
  return (
    <>
      {/* The two sides, and a lifeline under each. */}
      <path
        d={`M ${CODE} 56 L ${CODE} ${H - 8} M ${MODEL} 56 L ${MODEL} ${H - 8}`}
        strokeWidth={1}
        strokeDasharray="2 4"
        className="stroke-faint"
      />
      <Box x={8} y={16} w={112} h={40} label="your code" phase="past" />
      <Box x={200} y={16} w={112} h={40} label="model" phase="past" />

      <Message
        y={104}
        from={CODE}
        to={MODEL}
        label="question + tools"
        sub="Blue mug in stock?"
        step={step}
        at={0}
        n={1}
        on={focus.has(1)}
      />
      <Message
        y={172}
        from={MODEL}
        to={CODE}
        label="tool_use: check_stock"
        sub="product: blue mug"
        step={step}
        at={1}
        n={2}
        on={focus.has(2)}
      />

      <Box
        x={8}
        y={192}
        w={120}
        h={48}
        phase={running}
        label="check_stock()"
        sub="returns 4"
        radius={4}
      />
      <Marker x={144} y={216} n={3} on={focus.has(3)} />

      <Message
        y={288}
        from={CODE}
        to={MODEL}
        label="tool_result: 4"
        sub="id: toolu_01"
        step={step}
        at={3}
        n={4}
        on={focus.has(4)}
      />
      <Message
        y={344}
        from={MODEL}
        to={CODE}
        label="Yes, 4 are left."
        step={step}
        at={4}
        n={5}
        on={focus.has(5)}
      />

      <Token at={TRAVEL[step]!} visible={step !== 2} />
    </>
  );
}

/** One tool call, there and back: request, tool_use, run, tool_result, answer. */
export function ToolUseRoundTrip() {
  return (
    <SteppedFigure
      title="A tool use round trip between your code and the model"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
