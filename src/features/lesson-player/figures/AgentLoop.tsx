import { cn } from '@/lib/cn';
import { Arrow, Box, Diamond, Label, Marker, Token, type Phase, type Point } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const MAX_STEPS = 5;

const KEY: FigureKeyItem[] = [
  {
    n: 1,
    title: 'Messages',
    body: 'The goal, every reply and every tool result. Sent in full on each call.',
  },
  { n: 2, title: 'Model', body: 'Called once per turn, with the tools and the whole history.' },
  {
    n: 3,
    title: 'Stop condition',
    body: 'A tool_use stop reason keeps the loop going. Anything else ends it.',
  },
  {
    n: 4,
    title: 'Run the tools',
    body: 'Your code runs each requested tool and adds the results as a user message.',
  },
  {
    n: 5,
    title: 'Final answer',
    body: 'A reply with no tool call. Its text is what the user sees.',
  },
  {
    n: 6,
    title: 'Step cap',
    body: `At most ${MAX_STEPS} turns, so a confused model can't loop for ever.`,
  },
];

type Where = 'goal' | 'model' | 'check' | 'tools' | 'answer';

interface Moment extends FigureStep {
  at: Where;
  turn: number;
  messages: number;
}

const STEPS: Moment[] = [
  {
    text: 'The goal goes into messages: find the cheapest train to Leeds on Friday.',
    focus: [1],
    at: 'goal',
    turn: 0,
    messages: 1,
  },
  {
    text: 'Turn 1. The model reads the whole history and asks for a tool: search_trains.',
    focus: [2, 6],
    at: 'model',
    turn: 1,
    messages: 2,
  },
  {
    text: 'The stop reason is tool_use, so the loop goes on.',
    focus: [3],
    at: 'check',
    turn: 1,
    messages: 2,
  },
  {
    text: 'Your code runs search_trains and adds the result to messages.',
    focus: [4, 1],
    at: 'tools',
    turn: 1,
    messages: 3,
  },
  {
    text: 'Turn 2. The model asks for check_fare. Your code runs it and adds that result too.',
    focus: [2, 4, 6],
    at: 'tools',
    turn: 2,
    messages: 5,
  },
  {
    text: 'Turn 3. With the fares in hand, the model replies with text and no tool call.',
    focus: [2, 3, 6],
    at: 'check',
    turn: 3,
    messages: 6,
  },
  {
    text: `The stop reason is end_turn, so the loop ends and the text is the answer. At turn ${MAX_STEPS} the cap would have ended it instead.`,
    focus: [5],
    at: 'answer',
    turn: 3,
    messages: 6,
  },
];

const MESSAGES = [
  ['user', 'goal'],
  ['assistant', 'tool_use'],
  ['user', 'result'],
  ['assistant', 'tool_use'],
  ['user', 'result'],
  ['assistant', 'text'],
] as const;

const W = 320;
const H = 400;

const SPOT: Record<Where, Point> = {
  goal: [84, 36],
  model: [138, 108],
  check: [84, 168],
  tools: [244, 168],
  answer: [84, 280],
};

function draw(step: number, focus: ReadonlySet<number>) {
  const m = STEPS[step]!;
  const is = (where: Where): Phase =>
    m.at === where ? 'now' : step === 0 && where !== 'goal' ? 'future' : 'past';
  const answer: Phase = step === STEPS.length - 1 ? 'now' : 'future';
  const looping = step >= 3;

  return (
    <>
      <Box
        x={16}
        y={16}
        w={288}
        h={40}
        phase={is('goal')}
        label="Cheapest train to Leeds, Friday"
      />
      <Arrow
        points={[
          [84, 56],
          [84, 88],
        ]}
        phase={step >= 1 ? 'past' : 'future'}
      />

      <Box x={16} y={88} w={136} h={40} phase={focus.has(2) ? 'now' : is('model')} label="model" />
      <Arrow
        points={[
          [84, 128],
          [84, 156],
        ]}
        phase={step >= 2 ? 'past' : 'future'}
      />

      <Diamond
        cx={84}
        cy={188}
        rx={60}
        ry={32}
        label="tool_use?"
        phase={focus.has(3) ? 'now' : is('check')}
      />
      <Arrow
        points={[
          [144, 188],
          [184, 188],
        ]}
        phase={step >= 3 ? 'past' : 'future'}
      />
      <Label x={164} y={176} phase={step >= 3 ? 'past' : 'future'}>
        yes
      </Label>

      <Box
        x={184}
        y={168}
        w={120}
        h={40}
        phase={focus.has(4) ? 'now' : is('tools')}
        label="run tools"
      />
      <Arrow
        points={[
          [244, 168],
          [244, 108],
          [152, 108],
        ]}
        phase={looping ? 'past' : 'future'}
      />
      <Label x={252} y={138} anchor="start" phase={looping ? 'past' : 'future'}>
        again
      </Label>

      <Arrow
        points={[
          [84, 220],
          [84, 260],
        ]}
        phase={answer === 'now' ? 'past' : 'future'}
      />
      <Label x={96} y={240} anchor="start" phase={answer === 'now' ? 'past' : 'future'}>
        no
      </Label>
      <Box x={16} y={260} w={136} h={40} phase={answer} ink label="answer" />

      {/* The step cap: one square per turn taken, out of the most allowed. */}
      <Label x={40} y={328} anchor="start" phase="past" className="t-label">
        turns
      </Label>
      {Array.from({ length: MAX_STEPS }, (_, i) => (
        <rect
          key={i}
          x={40.5 + i * 24}
          y={344.5}
          width={16}
          height={16}
          rx={2}
          strokeWidth={1}
          strokeDasharray={i >= m.turn ? '3 3' : undefined}
          className={cn(
            i < m.turn ? 'fill-fg stroke-fg' : 'fill-surface stroke-faint',
            'transition-opacity duration-200 ease-out',
          )}
        />
      ))}
      <Label x={40} y={380} anchor="start" phase="past">
        {`${m.turn} of max ${MAX_STEPS}`}
      </Label>

      {/* Messages grows with every turn and is sent in full each time. */}
      <Label x={184} y={240} anchor="start" phase="past" className="t-label">
        messages
      </Label>
      {MESSAGES.map(([role, kind], i) => {
        const shown = i < m.messages;
        const fresh = shown && i >= (STEPS[step - 1]?.messages ?? 0);
        return (
          <g
            key={i}
            className={cn(
              'transition-opacity duration-200 ease-out',
              shown ? 'opacity-100' : 'opacity-0',
            )}
          >
            <rect
              x={184.5}
              y={256.5 + i * 22}
              width={119}
              height={18}
              rx={3}
              strokeWidth={fresh ? 2 : 1}
              className={cn(fresh ? 'fill-sunken stroke-fg' : 'fill-surface stroke-border')}
            />
            <Label x={192} y={266 + i * 22} anchor="start" phase={fresh ? 'now' : 'past'}>
              {`${role === 'user' ? 'user' : 'asst'} ${kind}`}
            </Label>
          </g>
        );
      })}

      <Token at={SPOT[m.at]} visible={m.at !== 'goal' && m.at !== 'answer'} />

      <Marker x={296} y={240} n={1} on={focus.has(1)} />
      <Marker x={16} y={108} n={2} on={focus.has(2)} />
      <Marker x={24} y={188} n={3} on={focus.has(3)} />
      <Marker x={304} y={188} n={4} on={focus.has(4)} />
      <Marker x={16} y={280} n={5} on={focus.has(5)} />
      <Marker x={16} y={352} n={6} on={focus.has(6)} />
    </>
  );
}

/** The agent loop: call, check the stop reason, run tools, repeat, within a step cap. */
export function AgentLoop() {
  return (
    <SteppedFigure
      title="The agent loop: the model is called, its tool calls are run, and the loop repeats until a reply has no tool call or the step cap is hit"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
