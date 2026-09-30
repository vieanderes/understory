import { resolveFlex } from './flex';
import { px } from './format';
import { resolveTracks } from './grid';
import { trackListCss } from './scenarios';
import type { ArithmeticLine, FlexScenario, Focus, Frame, GridScenario, Scenario } from './types';

/** Collects steps so that each frame carries every line worked out before it. */
function builder() {
  const frames: Frame[] = [];
  const lines: ArithmeticLine[] = [];
  return {
    frames,
    add(focus: Focus, status: string, active: readonly number[], added: ArithmeticLine[] = []) {
      lines.push(...added);
      frames.push({ focus, status, active, arithmetic: [...lines], revealed: false });
    },
    finish(status: string) {
      frames.push({
        focus: 'measured',
        status,
        active: [],
        arithmetic: [...lines],
        revealed: true,
      });
    },
  };
}

const list = (values: readonly number[]) => values.map(px).join(', ');
const names = (labels: readonly string[]) =>
  labels.length < 2
    ? labels.join('')
    : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;

function flexFrames(scenario: FlexScenario): Frame[] {
  const { items, containerWidth, gap } = scenario;
  const r = resolveFlex(containerWidth, items, gap);
  const b = builder();
  const all = items.map((_, i) => i);
  const label = (i: number) => items[i]!.label;
  const gapTotal = containerWidth - r.available;

  b.add(
    'setup',
    `The row is ${px(containerWidth)} px wide and holds ${items.length} items. Predict each width.`,
    [],
  );

  const lifted = all.filter((i) => r.hypothetical[i]! > r.bases[i]!);
  b.add(
    'base',
    lifted.length > 0
      ? `Each item starts at its flex-basis, but ${names(lifted.map(label))} cannot go below a minimum of ${list(lifted.map((i) => r.mins[i]!))}. The starting sizes add up to ${px(r.sumHypothetical)}.`
      : `Each item starts at its flex-basis. The base sizes add up to ${px(r.sumHypothetical)}.`,
    all,
    [
      {
        label: 'Sum of starting sizes',
        expression: r.hypothetical.map(px).join(' + '),
        result: px(r.sumHypothetical),
      },
    ],
  );

  const taken = r.available - r.initialFreeSpace;
  const direction =
    r.mode === 'grow'
      ? `${px(r.initialFreeSpace)} px are free, so the grow factors apply`
      : r.initialFreeSpace === 0
        ? 'Nothing is free and nothing is missing'
        : `${px(-r.initialFreeSpace)} px are missing, so the shrink factors apply`;
  const frozenNote =
    r.frozenAtStart.length === 0
      ? ''
      : r.frozenAtStart.length === items.length
        ? ' No item can flex: each has a factor of 0 or sits at its minimum.'
        : ` ${names(r.frozenAtStart.map(label))} cannot flex and stay${r.frozenAtStart.length === 1 ? 's' : ''} as ${r.frozenAtStart.length === 1 ? 'it is' : 'they are'}.`;
  b.add('free-space', `${direction}.${frozenNote}`, r.frozenAtStart, [
    {
      label: 'Free space',
      expression:
        gapTotal > 0
          ? `${px(containerWidth)} − ${px(gapTotal)} − ${px(taken)}`
          : `${px(containerWidth)} − ${px(taken)}`,
      result: px(r.initialFreeSpace),
    },
  ]);

  r.rounds.forEach((round, n) => {
    const flexing = all.filter((i) => round.shares[i] !== 0 || round.clamped.includes(i));
    const again = n > 0 ? 'Again, without the frozen items. ' : '';
    b.add(
      'shares',
      r.mode === 'grow'
        ? `${again}Each item gets free space × its grow factor ÷ the sum of grow factors, ${px(round.factorSum)}.`
        : `${again}Each item gives up the deficit × its shrink factor × its content width (base size without padding and border) ÷ the sum of those products, ${px(round.factorSum)}. A wider item gives up more.`,
      flexing,
      flexing.map((i) => {
        const it = items[i]!;
        return {
          label: label(i),
          expression:
            r.mode === 'grow'
              ? `${px(r.bases[i]!)} + ${px(round.freeSpace)} × ${px(it.grow)} ÷ ${px(round.factorSum)}`
              : `${px(r.bases[i]!)} − ${px(-round.freeSpace)} × ${px(it.shrink * r.innerBases[i]!)} ÷ ${px(round.factorSum)}`,
          result: px(round.tentative[i]!),
        };
      }),
    );

    if (round.clamped.length > 0) {
      const owed = round.clamped.reduce((t, i) => t + r.mins[i]! - round.tentative[i]!, 0);
      b.add(
        'clamp',
        `${names(round.clamped.map(label))} would fall below the minimum, so the minimum wins and the item is frozen. The ${px(owed)} px it could not give up are shared out again.`,
        round.clamped,
        round.clamped.map((i) => ({
          label: `${label(i)}, clamped`,
          expression: `max(${px(round.tentative[i]!)}, ${px(r.mins[i]!)})`,
          result: px(r.mins[i]!),
        })),
      );
    }
  });

  const overflow = r.sizes.reduce((a, c) => a + c, 0) - r.available;
  b.finish(
    `Revealed: the browser's measurement beside the predicted ${list(r.sizes)}.${overflow > 0.005 ? ` The items overflow the row by ${px(overflow)} px.` : ''}`,
  );
  return b.frames;
}

function gridFrames(scenario: GridScenario): Frame[] {
  const { tracks, containerWidth, gap, itemCount } = scenario;
  const r = resolveTracks(containerWidth, gap, tracks, itemCount);
  const b = builder();
  const all = r.tracks.map((_, i) => i);
  const live = all.filter((i) => !r.tracks[i]!.collapsed);

  b.add(
    'setup',
    `The grid is ${px(containerWidth)} px wide with columns ${trackListCss(tracks)}. Predict each column.`,
    [],
  );

  const repeat = tracks.find((t) => t.kind === 'repeat');
  if (repeat && r.repetitions !== null && r.repeatUnit !== null) {
    const others = tracks.flatMap((t) => (t.kind === 'px' ? [t.size] : []));
    const room = containerWidth - others.reduce((a, c) => a + c + gap, 0) + gap;
    b.add(
      'repeat',
      `A repetition counts as ${px(r.repeatUnit)} plus a gap. ${r.repetitions} fit${r.repetitions === 1 ? 's' : ''}; there is never less than one.`,
      all,
      [
        {
          label: 'Repetitions',
          expression: `floor(${px(room)} ÷ (${px(r.repeatUnit)} + ${px(gap)}))`,
          result: String(r.repetitions),
        },
      ],
    );
    const empty = r.tracks.length - Math.min(itemCount, r.tracks.length);
    if (empty > 0) {
      const collapsed = all.filter((i) => r.tracks[i]!.collapsed);
      b.add(
        'repeat',
        repeat.mode === 'auto-fit'
          ? `${itemCount} items fill ${itemCount} columns. auto-fit collapses the ${empty} empty one${empty === 1 ? '' : 's'} to 0 together with the gap, and the rest share the whole width.`
          : `${itemCount} items fill ${itemCount} columns. auto-fill keeps the ${empty} empty one${empty === 1 ? '' : 's'}, and each still takes its share.`,
        repeat.mode === 'auto-fit' ? collapsed : all.slice(itemCount),
      );
    }
  }

  const free = containerWidth - r.gapTotal - r.fixedTotal;
  b.add(
    'fixed',
    `Gaps, px tracks, content-sized tracks and minimums are resolved first. They take ${px(r.gapTotal + r.fixedTotal)} px and leave ${px(free)}.`,
    live.filter((i) => tracks[r.tracks[i]!.source]!.kind !== 'fr'),
    [
      {
        label: 'Left after fixed sizes',
        expression: `${px(containerWidth)} − ${px(r.gapTotal)} − ${px(r.fixedTotal)}`,
        result: px(free),
      },
    ],
  );

  if (r.maximised > 0) {
    const growing = live.filter((i) => {
      const t = tracks[r.tracks[i]!.source]!;
      return (t.kind === 'minmax' || t.kind === 'repeat') && t.maxUnit === 'px';
    });
    b.add(
      'maximise',
      `A minmax() track with a px maximum grows towards it before any fr is sized. That takes ${px(r.maximised)} px more.`,
      growing,
      [
        {
          label: 'Left after maximising',
          expression: `${px(free)} − ${px(r.maximised)}`,
          result: px(free - r.maximised),
        },
      ],
    );
  }

  if (r.frSize !== null && r.frPool !== null && r.flexSum !== null && r.leftover !== null) {
    const flexible = live.filter((i) => {
      const t = tracks[r.tracks[i]!.source]!;
      return (
        t.kind === 'fr' || ((t.kind === 'minmax' || t.kind === 'repeat') && t.maxUnit === 'fr')
      );
    });
    const kept = r.frPool !== r.leftover;
    b.add(
      'fr',
      `${kept ? 'A flexible track whose minimum is larger than its share keeps the minimum and leaves the pool. ' : ''}The remainder divided by the sum of fr factors is the size of 1fr: ${px(Math.max(0, r.frSize))}.`,
      flexible,
      [
        {
          label: '1fr',
          expression: `${px(r.frPool)} ÷ ${px(r.flexSum)}`,
          result: px(r.frSize),
        },
      ],
    );
  }

  if (r.stretched > 0) {
    const autos = live.filter((i) => tracks[r.tracks[i]!.source]!.kind === 'auto');
    b.add(
      'stretch',
      `No fr track claims the remaining ${px(r.stretched)} px, so the auto tracks stretch and split them equally.`,
      autos,
      [
        {
          label: 'Each auto track gains',
          expression: `${px(r.stretched)} ÷ ${autos.length}`,
          result: px(r.stretched / autos.length),
        },
      ],
    );
  }

  b.finish(
    `Revealed: the browser's measurement beside the predicted ${list(r.tracks.map((t) => t.size))}.`,
  );
  return b.frames;
}

/** Every step of the explanation, computed up front. */
export function run(scenario: Scenario): Frame[] {
  return scenario.kind === 'flex' ? flexFrames(scenario) : gridFrames(scenario);
}
