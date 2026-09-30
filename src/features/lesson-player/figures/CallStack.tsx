import { cn } from '@/lib/cn';
import { CodePanel, Label, Marker, Stack } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const SOURCE = [
  'function greet(name) {',
  '  return "Hi, " + name;',
  '}',
  'function welcome() {',
  '  console.log(greet("Sam"));',
  '}',
  'welcome();',
];

const KEY: FigureKeyItem[] = [
  { n: 1, title: 'The running line', body: 'Where the computer is right now.' },
  { n: 2, title: 'The call stack', body: 'The functions still running, newest on top.' },
  { n: 3, title: 'A frame', body: 'One call: which function, and its own variables.' },
  {
    n: 4,
    title: 'A return',
    body: 'Takes the top frame off, and hands its value back to the line that called.',
  },
];

interface Moment extends FigureStep {
  line: number;
  frames: readonly ('welcome' | 'greet')[];
  returned?: boolean;
}

const STEPS: Moment[] = [
  {
    text: 'Line 7 calls welcome. welcome goes on the stack.',
    focus: [1, 3],
    line: 7,
    frames: ['welcome'],
  },
  {
    text: 'Inside welcome, line 5 calls greet with "Sam". greet goes on top, with its own name variable.',
    focus: [2, 3],
    line: 5,
    frames: ['welcome', 'greet'],
  },
  {
    text: 'greet runs line 2. welcome is paused underneath, waiting for greet to finish.',
    focus: [1, 2],
    line: 2,
    frames: ['welcome', 'greet'],
  },
  {
    text: 'greet returns "Hi, Sam" and comes off the top. welcome carries on at line 5 and logs it.',
    focus: [4],
    line: 5,
    frames: ['welcome'],
    returned: true,
  },
  {
    text: 'welcome reaches its end and comes off too. The stack is empty, so the program is done.',
    focus: [2],
    line: 7,
    frames: [],
  },
];

const W = 320;
const H = 336;

const FRAME_LABEL = { welcome: 'welcome()', greet: 'greet, name = "Sam"' } as const;

function draw(step: number, focus: ReadonlySet<number>) {
  const m = STEPS[step]!;
  return (
    <>
      <CodePanel x={16} y={16} w={288} lines={SOURCE} current={[m.line]} />

      {/* The value greet hands back, where its frame was. */}
      <g
        className={cn(
          'transition-opacity duration-200 ease-out',
          m.returned ? 'opacity-100' : 'opacity-0',
        )}
      >
        <Label x={160} y={234} phase="now" weight="medium">
          {'returned "Hi, Sam"'}
        </Label>
      </g>

      <Stack
        x={56}
        bottom={296}
        w={208}
        rowH={36}
        capacity={2}
        label="call stack"
        items={m.frames.map((f) => ({ key: f, label: FRAME_LABEL[f] }))}
      />
      {m.frames.length === 0 ? (
        <Label x={160} y={278} phase="future">
          empty
        </Label>
      ) : null}
      <Label x={160} y={316} phase="past" className="t-label">
        bottom
      </Label>

      <Marker x={16} y={24 + (m.line - 1) * 20 + 10} n={1} on={focus.has(1)} />
      <Marker x={40} y={296} n={2} on={focus.has(2)} />
      <Marker
        x={264}
        y={m.frames.length > 0 ? 296 - m.frames.length * 44 + 26 : 278}
        n={3}
        on={focus.has(3)}
      />
      <Marker x={36} y={234} n={4} on={focus.has(4)} />
    </>
  );
}

/** Frames pushed on a call and popped on a return, beside the code that does it. */
export function CallStack() {
  return (
    <SteppedFigure
      title="The call stack as welcome calls greet and both return"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
