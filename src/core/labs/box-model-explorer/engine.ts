import type { BoxInput, BoxResult, StackInput, StackResult } from './types';

/**
 * The size of one box.
 *
 * CSS 2.2 section 8.4: a percentage padding refers to the width of the containing block,
 * "even for padding-top and padding-bottom". So 10% of a 320 px column is 32 px on all
 * four sides, whatever the height of the box.
 *
 * CSS Box Sizing 3 section 3 (`box-sizing`): under `content-box`, `width` and `height`
 * size the content box and padding and border are added outside. Under `border-box` they
 * size the border box, and the content box is what is left, floored at zero. When padding
 * and border alone exceed the declared size, the border box grows to hold them.
 */
export function boxSize(input: BoxInput): BoxResult {
  const padding =
    input.paddingUnit === 'percent' ? (input.containerWidth * input.padding) / 100 : input.padding;
  const extra = 2 * padding + 2 * input.border;

  const content =
    input.boxSizing === 'content-box'
      ? { width: input.width, height: input.height }
      : { width: Math.max(0, input.width - extra), height: Math.max(0, input.height - extra) };

  const paddingBox = { width: content.width + 2 * padding, height: content.height + 2 * padding };
  const borderBox = { width: content.width + extra, height: content.height + extra };
  const marginBox = {
    width: borderBox.width + 2 * input.margin,
    height: borderBox.height + 2 * input.margin,
  };
  return { padding, content, paddingBox, borderBox, marginBox };
}

/**
 * CSS 2.2 section 8.3.1, collapsing margins: "When two or more margins collapse, the
 * resulting margin width is the maximum of the collapsing margins' widths. In the case of
 * negative margins, the maximum of the absolute values of the negative adjoining margins
 * is deducted from the maximum of the positive adjoining margins. If there are no
 * positive margins, the maximum of the absolute values of the adjoining margins is
 * deducted from zero."
 */
export function collapseMargins(margins: readonly number[]): number {
  const largestPositive = Math.max(0, ...margins);
  const mostNegative = Math.min(0, ...margins);
  return largestPositive + mostNegative;
}

/** The gap between two in-flow blocks whose vertical margins adjoin. */
export function collapsedGap(marginA: number, marginB: number): number {
  return collapseMargins([marginA, marginB]);
}

/**
 * Two stacked blocks in a parent.
 *
 * CSS 2.2 section 8.3.1: margins adjoin only when both belong to in-flow block-level
 * boxes in the same block formatting context, with no padding, border, line box or
 * clearance between them.
 *
 *  - Siblings. A's bottom margin and B's top margin adjoin in normal flow. Padding or a
 *    border on the parent, or `display: flow-root` on it, does not come between the two
 *    siblings, so they still collapse. A flex or grid parent turns them into flex or grid
 *    items, whose margins never collapse (CSS Flexbox 1 section 3, CSS Grid 1 section 6.1),
 *    and the gap becomes the sum.
 *  - Parent and first child. A's top margin adjoins the parent's top margin unless the
 *    parent has top padding or a top border, or establishes a new formatting context
 *    (flow-root, flex, grid). When they collapse, the joint margin sits outside the
 *    parent: the parent moves down and A touches its top edge.
 */
export function stackLayout(input: StackInput): StackResult {
  const itemsAreBlocks = input.parent !== 'flex' && input.parent !== 'grid';
  const gap = itemsAreBlocks
    ? collapsedGap(input.marginBottomA, input.marginTopB)
    : input.marginBottomA + input.marginTopB;

  const parentCollapses = input.parent === 'plain';
  const between =
    input.parent === 'padding'
      ? input.parentPadding
      : input.parent === 'border'
        ? input.parentBorder
        : 0;

  return {
    siblingsCollapse: itemsAreBlocks,
    gap,
    parentCollapses,
    childOffset: parentCollapses ? 0 : between + input.marginTopA,
    // The parent's own top margin is zero, so the joint margin is A's against zero.
    parentOffset: parentCollapses ? collapsedGap(0, input.marginTopA) : 0,
  };
}
