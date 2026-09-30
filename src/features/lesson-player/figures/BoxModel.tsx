import { cn } from '@/lib/cn';
import { Dim, Label, Marker } from './kit/svg';
import { SteppedFigure, type FigureKeyItem, type FigureStep } from './kit/SteppedFigure';

/*
 * Drawn to scale, one unit per pixel: `width: 200px; padding: 24px; border: 2px solid;
 * margin: 16px`. So the 252 the learner reads on the dimension line is what a browser
 * would really give the box.
 */
const CONTENT_W = 200;
const CONTENT_H = 64;
const PAD = 24;
const BORDER = 2;
const MARGIN = 16;

const KEY: FigureKeyItem[] = [
  { n: 1, title: 'Content', body: 'The text or image. By default, width sets this area alone.' },
  { n: 2, title: 'Padding', body: 'Space inside the border. The background fills it.' },
  { n: 3, title: 'Border', body: 'The line around the padding.' },
  { n: 4, title: 'Margin', body: 'Space outside, keeping neighbours away. Never filled.' },
  {
    n: 5,
    title: 'Width on screen',
    body: 'width + padding + border, unless box-sizing is border-box.',
  },
];

const STEPS: FigureStep[] = [
  {
    text: 'The content: here, three lines of text. width: 200px sets this area alone.',
    focus: [1],
  },
  {
    text: 'padding: 24px adds space inside, on every side. The background fills it too.',
    focus: [2],
  },
  { text: 'border: 2px draws a line around the padding.', focus: [3] },
  {
    text: 'margin: 16px keeps neighbours away. It is outside the border, and the background never fills it.',
    focus: [4],
  },
  {
    text: 'On screen the box is 200 + 48 + 4 = 252 px wide. With box-sizing: border-box, width would mean the whole 252.',
    focus: [5],
  },
];

const W = 320;
const H = 264;

const X0 = (W - (CONTENT_W + 2 * (PAD + BORDER + MARGIN))) / 2;
const Y0 = 24;
const margin = {
  x: X0,
  y: Y0,
  w: CONTENT_W + 2 * (PAD + BORDER + MARGIN),
  h: CONTENT_H + 2 * (PAD + BORDER + MARGIN),
};
const border = {
  x: X0 + MARGIN,
  y: Y0 + MARGIN,
  w: margin.w - 2 * MARGIN,
  h: margin.h - 2 * MARGIN,
};
const padding = {
  x: border.x + BORDER,
  y: border.y + BORDER,
  w: border.w - 2 * BORDER,
  h: border.h - 2 * BORDER,
};
const content = { x: padding.x + PAD, y: padding.y + PAD, w: CONTENT_W, h: CONTENT_H };

function fade(on: boolean) {
  return cn('transition-opacity duration-200 ease-out', on ? 'opacity-100' : 'opacity-0');
}

function draw(step: number, focus: ReadonlySet<number>) {
  const lines = [0.92, 0.78, 0.5];
  return (
    <>
      {/* Margin: a dashed outline only, because nothing is ever painted there. */}
      <rect
        x={margin.x + 0.5}
        y={margin.y + 0.5}
        width={margin.w - 1}
        height={margin.h - 1}
        strokeWidth={step === 3 ? 2 : 1}
        strokeDasharray="3 4"
        className={cn('fill-none', step === 3 ? 'stroke-fg' : 'stroke-muted', fade(step >= 3))}
      />

      {/* The background: content and padding, never the margin. */}
      <rect
        x={padding.x}
        y={padding.y}
        width={padding.w}
        height={padding.h}
        className={cn('fill-sunken', fade(step >= 1))}
      />
      <rect
        x={content.x + 0.5}
        y={content.y + 0.5}
        width={content.w - 1}
        height={content.h - 1}
        strokeWidth={1}
        strokeDasharray={step >= 1 ? '3 4' : undefined}
        className={cn('fill-none', step === 0 ? 'stroke-fg' : 'stroke-muted')}
      />
      {lines.map((k, i) => (
        <rect
          key={i}
          x={content.x + 12}
          y={content.y + 14 + i * 14}
          width={(content.w - 24) * k}
          height={6}
          rx={3}
          className={step === 0 ? 'fill-fg' : 'fill-muted'}
        />
      ))}

      <rect
        x={border.x + BORDER / 2}
        y={border.y + BORDER / 2}
        width={border.w - BORDER}
        height={border.h - BORDER}
        strokeWidth={BORDER}
        className={cn('fill-none', step === 2 ? 'stroke-fg' : 'stroke-muted', fade(step >= 2))}
      />

      {/* Measures, written on dimension lines. */}
      <g className={fade(step >= 1)}>
        <Dim
          from={[content.x + 160, padding.y]}
          to={[content.x + 160, content.y]}
          phase={step === 1 ? 'now' : 'past'}
        />
        <Label
          x={content.x + 168}
          y={padding.y + PAD / 2}
          anchor="start"
          phase={step === 1 ? 'now' : 'past'}
        >
          24
        </Label>
      </g>
      <g className={fade(step >= 3)}>
        <Dim
          from={[margin.x + 20, margin.y]}
          to={[margin.x + 20, border.y]}
          phase={step === 3 ? 'now' : 'past'}
        />
        <Label
          x={margin.x + 28}
          y={margin.y + MARGIN / 2}
          anchor="start"
          phase={step === 3 ? 'now' : 'past'}
        >
          16
        </Label>
      </g>
      <Dim
        from={[content.x, margin.y + margin.h + 16]}
        to={[content.x + content.w, margin.y + margin.h + 16]}
        label="width 200"
        side="after"
        phase={step === 0 ? 'now' : 'past'}
      />
      <g className={fade(step >= 4)}>
        <Dim
          from={[border.x, margin.y + margin.h + 48]}
          to={[border.x + border.w, margin.y + margin.h + 48]}
          label="252 on screen"
          side="after"
          phase={step === 4 ? 'now' : 'past'}
        />
        <Marker x={border.x - 12} y={margin.y + margin.h + 48} n={5} on={focus.has(5)} />
      </g>

      <Marker
        x={content.x + content.w - 20}
        y={content.y + content.h - 16}
        n={1}
        on={focus.has(1)}
      />
      <Marker x={padding.x + PAD / 2} y={padding.y + padding.h / 2} n={2} on={focus.has(2)} />
      <Marker x={border.x + border.w} y={border.y + border.h / 2} n={3} on={focus.has(3)} />
      <Marker
        x={margin.x + margin.w - MARGIN / 2}
        y={margin.y + MARGIN / 2}
        n={4}
        on={focus.has(4)}
      />
    </>
  );
}

/** The four layers of a box, drawn to scale, and what width really measures. */
export function BoxModel() {
  return (
    <SteppedFigure
      title="The CSS box model: content, padding, border and margin, drawn to scale"
      width={W}
      height={H}
      keyItems={KEY}
      steps={STEPS}
      draw={draw}
    />
  );
}
