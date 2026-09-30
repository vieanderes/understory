import { Arrow, Box, CodePanel, Label, Marker, type Phase } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

const SOURCE = [
  '<body>',
  '  <h1>Opening times</h1>',
  '  <ul>',
  '    <li>Weekdays</li>',
  '    <li>Saturday</li>',
  '  </ul>',
  '</body>',
];

const KEY: FigureKeyItem[] = [
  { n: 1, title: 'A tag', body: 'Text in your file. The browser reads it once.' },
  {
    n: 2,
    title: 'An element object',
    body: 'One per element, built from the tags. Scripts and styles work on these.',
  },
  { n: 3, title: 'Parent and child', body: 'An element written inside another is its child.' },
  { n: 4, title: 'Siblings', body: 'Children of the same parent, in the order they were written.' },
  { n: 5, title: 'Text', body: 'The words inside an element are a node of their own.' },
];

interface Moment extends FigureStep {
  lines: readonly number[];
}

const STEPS: Moment[] = [
  {
    text: 'The browser reads <body> and builds its object. It is the root: everything else goes inside it.',
    focus: [1, 2],
    lines: [1, 7],
  },
  {
    text: '<h1> is written inside <body>, so its object is a child of body. Its words become a text node.',
    focus: [3, 5],
    lines: [2],
  },
  {
    text: '<ul> is inside <body> too: a second child, and a sibling of h1.',
    focus: [4],
    lines: [3, 6],
  },
  {
    text: 'Each <li> is inside the <ul>, so both are children of ul, and siblings of each other.',
    focus: [3, 4],
    lines: [4, 5],
  },
  {
    text: 'One object per element, nested like the tags. That tree is the DOM, and the screen is drawn from it.',
    focus: [2],
    lines: [],
  },
];

const W = 320;
const H = 424;

const TOP = 200;
const LEVEL = 64;

interface Node {
  id: string;
  label: string;
  x: number;
  level: number;
  at: number;
  parent?: string;
  text?: boolean;
}

const NODES: Node[] = [
  { id: 'body', label: 'body', x: 160, level: 0, at: 0 },
  { id: 'h1', label: 'h1', x: 88, level: 1, at: 1, parent: 'body' },
  { id: 'h1-text', label: '"Opening times"', x: 88, level: 2, at: 1, parent: 'h1', text: true },
  { id: 'ul', label: 'ul', x: 228, level: 1, at: 2, parent: 'body' },
  { id: 'li-1', label: 'li', x: 176, level: 2, at: 3, parent: 'ul' },
  { id: 'li-2', label: 'li', x: 280, level: 2, at: 3, parent: 'ul' },
  { id: 'li-1-text', label: '"Weekdays"', x: 176, level: 3, at: 3, parent: 'li-1', text: true },
  { id: 'li-2-text', label: '"Saturday"', x: 280, level: 3, at: 3, parent: 'li-2', text: true },
];

const BOX_W = 56;
const BOX_H = 32;
const yOf = (level: number) => TOP + level * LEVEL;

function phaseOf(node: Node, step: number): Phase {
  if (step < node.at) return 'hidden';
  if (step === node.at) return 'now';
  return 'past';
}

function draw(step: number, focus: ReadonlySet<number>) {
  const m = STEPS[step]!;
  const byId = new Map(NODES.map((n) => [n.id, n]));
  return (
    <>
      <CodePanel x={16} y={16} w={288} lines={SOURCE} current={m.lines} />

      {NODES.filter((n) => n.parent).map((n) => {
        const p = byId.get(n.parent!)!;
        const fromY = yOf(p.level) + BOX_H;
        const toY = n.text ? yOf(n.level) + 4 : yOf(n.level);
        const mid = (fromY + toY) / 2;
        return (
          <Arrow
            key={n.id}
            points={[
              [p.x, fromY],
              [p.x, mid],
              [n.x, mid],
              [n.x, toY],
            ]}
            phase={phaseOf(n, step)}
            headAt="none"
          />
        );
      })}

      {NODES.map((n) =>
        n.text ? (
          <Label key={n.id} x={n.x} y={yOf(n.level) + 14} phase={phaseOf(n, step)}>
            {n.label}
          </Label>
        ) : (
          <Box
            key={n.id}
            x={n.x - BOX_W / 2}
            y={yOf(n.level)}
            w={BOX_W}
            h={BOX_H}
            radius={4}
            phase={phaseOf(n, step)}
            label={n.label}
          />
        ),
      )}

      <Marker x={16} y={34} n={1} on={focus.has(1)} />
      <Marker x={120} y={yOf(0) + 16} n={2} on={focus.has(2)} />
      <Marker x={88} y={yOf(0) + 48} n={3} on={focus.has(3)} />
      <Marker x={228} y={yOf(1) + 48} n={4} on={focus.has(4)} />
      <Marker x={16} y={yOf(2) + 14} n={5} on={focus.has(5)} />
    </>
  );
}

/** HTML read tag by tag into a tree of element objects: the DOM. */
export function DomTree() {
  return (
    <SteppedFigure
      title="An HTML file and the DOM tree the browser builds from it"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
