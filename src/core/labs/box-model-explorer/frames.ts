import { boxSize, stackLayout } from './engine';
import { px } from './format';
import type { ArithmeticLine, BoxInput, Focus, Frame, Scenario, StackInput } from './types';

/** Collects steps so that each frame carries every line worked out before it. */
function builder() {
  const frames: Frame[] = [];
  const lines: ArithmeticLine[] = [];
  return {
    frames,
    add(focus: Focus, status: string, line?: ArithmeticLine) {
      if (line) lines.push(line);
      frames.push({ focus, status, arithmetic: [...lines], revealed: false });
    },
    finish(status: string) {
      frames.push({ focus: 'measured', status, arithmetic: [...lines], revealed: true });
    },
  };
}

const size = (s: { width: number; height: number }) => `${px(s.width)} × ${px(s.height)}`;

function boxFrames(box: BoxInput): Frame[] {
  const result = boxSize(box);
  const b = builder();
  const declared = `${px(box.width)} × ${px(box.height)}`;
  const padding = px(result.padding);
  const border = px(box.border);

  b.add(
    'setup',
    `The box declares ${declared} under ${box.boxSizing}. Predict its size on screen.`,
  );

  if (box.paddingUnit === 'percent') {
    b.add(
      'padding',
      `Percentage padding resolves against the containing block's width, ${px(box.containerWidth)} px, on all four sides. The height plays no part.`,
      {
        label: 'Padding',
        expression: `${px(box.padding)}% × ${px(box.containerWidth)}`,
        result: padding,
      },
    );
  }

  if (box.boxSizing === 'content-box') {
    b.add('content', `Under content-box the declared size is the content box: ${declared}.`, {
      label: 'Content',
      expression: declared,
      result: size(result.content),
    });
  } else {
    b.add(
      'content',
      `Under border-box the declared size is the border box. The content gets what padding and border leave: ${size(result.content)}.`,
      {
        label: 'Content width',
        expression: `max(0, ${px(box.width)} − 2 × ${padding} − 2 × ${border})`,
        result: px(result.content.width),
      },
    );
  }

  b.add('padding', `Padding adds ${padding} on each side: ${size(result.paddingBox)}.`, {
    label: 'Padding box width',
    expression: `${px(result.content.width)} + 2 × ${padding}`,
    result: px(result.paddingBox.width),
  });

  b.add(
    'border',
    `The border adds ${border} on each side. The border box, ${size(result.borderBox)}, is what the browser reports as the element's size.`,
    {
      label: 'Border box width',
      expression: `${px(result.paddingBox.width)} + 2 × ${border}`,
      result: px(result.borderBox.width),
    },
  );

  b.add(
    'margin',
    `Margin paints nothing and still takes room: the box occupies ${size(result.marginBox)} in its column.`,
    {
      label: 'Margin box width',
      expression: `${px(result.borderBox.width)} + 2 × ${px(box.margin)}`,
      result: px(result.marginBox.width),
    },
  );

  b.finish(`Revealed: the browser's measurement beside the predicted ${size(result.borderBox)}.`);
  return b.frames;
}

const PARENT_REASON: Record<StackInput['parent'], string> = {
  plain: 'Nothing separates the first paragraph from the top of its parent',
  padding: 'The top padding of the parent sits between the two margins',
  border: 'The top border of the parent sits between the two margins',
  'flow-root': 'A flow-root parent starts a new block formatting context',
  flex: 'A flex container starts a new formatting context',
  grid: 'A grid container starts a new formatting context',
};

function stackFrames(stack: StackInput): Frame[] {
  const result = stackLayout(stack);
  const b = builder();
  const below = px(stack.marginBottomA);
  const above = px(stack.marginTopB);
  const top = px(stack.marginTopA);

  b.add(
    'setup',
    `Two paragraphs stacked: ${below} below the first, ${above} above the second. Predict the gap.`,
  );

  if (result.siblingsCollapse) {
    const mixed = Math.min(stack.marginBottomA, stack.marginTopB) < 0;
    b.add(
      'siblings',
      mixed
        ? `The two margins adjoin and collapse. With a negative margin, the most negative is added to the largest positive: ${px(result.gap)}.`
        : `The two margins adjoin and collapse into the larger one, ${px(result.gap)}, not the sum. Padding, a border or flow-root on the parent does not come between siblings.`,
      {
        label: 'Gap between paragraphs',
        expression: mixed
          ? `max(0, ${below}, ${above}) + min(0, ${below}, ${above})`
          : `max(${below}, ${above})`,
        result: px(result.gap),
      },
    );
  } else {
    b.add(
      'siblings',
      `In a ${stack.parent} container the paragraphs are ${stack.parent} items, and their margins never collapse: the gap is the sum, ${px(result.gap)}.`,
      {
        label: 'Gap between paragraphs',
        expression: `${below} + ${above}`,
        result: px(result.gap),
      },
    );
  }

  if (result.parentCollapses) {
    b.add(
      'parent',
      `${PARENT_REASON[stack.parent]}, so its top margin ${top} collapses with the parent's and ends up outside: the parent moves down ${px(result.parentOffset)} and the paragraph touches its top edge.`,
      { label: 'First paragraph inside parent', expression: 'margin escapes', result: px(0) },
    );
  } else {
    const between =
      stack.parent === 'padding'
        ? stack.parentPadding
        : stack.parent === 'border'
          ? stack.parentBorder
          : 0;
    b.add(
      'parent',
      `${PARENT_REASON[stack.parent]}, so the first paragraph keeps its top margin inside: it sits ${px(result.childOffset)} below the parent's edge.`,
      {
        label: 'First paragraph inside parent',
        expression: between > 0 ? `${px(between)} + ${top}` : top,
        result: px(result.childOffset),
      },
    );
  }

  b.finish(`Revealed: the browser's measurement beside the predicted gap of ${px(result.gap)}.`);
  return b.frames;
}

/** Every step of the explanation, computed up front. */
export function run(scenario: Scenario): Frame[] {
  return scenario.kind === 'box' ? boxFrames(scenario.box) : stackFrames(scenario.stack);
}
