import type { FlexItem, FlexResult, FlexRound } from './types';

const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/**
 * CSS Flexbox 1 section 4.5: `min-width: auto` on a flex item is its content-based
 * minimum, here the min-content width the caller measured. A minimum is never negative.
 */
function usedMinimum(item: FlexItem): number {
  const edges = item.edges ?? 0;
  return Math.max(edges, item.minWidth === 'auto' ? (item.minContent ?? 0) : item.minWidth);
}

/**
 * Under `box-sizing: border-box` a `flex-basis` includes padding and border. The flex
 * base size the algorithm works with is the content box inside it, which is never
 * negative (section 9.2, step 3); the outer size adds the edges back.
 */
function innerBase(item: FlexItem): number {
  return Math.max(0, item.basis - (item.edges ?? 0));
}

/**
 * CSS Flexible Box Layout 1, section 9.7, "Resolving Flexible Lengths", for one line of
 * items with `flex-basis` in px and a minimum width.
 *
 *  1. Sum the hypothetical main sizes (base size clamped by the minimum). Less than the
 *     container: use the grow factors. Otherwise: the shrink factors.
 *  2. Freeze inflexible items at their hypothetical size: a factor of zero, or, while
 *     shrinking, a base size below the hypothetical size (the minimum lifted it).
 *  3. Initial free space: container minus gaps, frozen sizes and unfrozen base sizes.
 *  4. Loop. Free space goes out in proportion to the grow factor, or comes off in
 *     proportion to shrink factor × inner base size (the scaled shrink factor, which
 *     leaves out padding and border), so a wide item
 *     gives up more than a narrow one. A sum of factors below 1 hands out only that
 *     fraction of the initial free space. Each item below its minimum is clamped and
 *     frozen; what it could not give up is redistributed in the next pass. A pass with
 *     no violation freezes everything.
 *
 * Left out: `max-width` (so only minimum violations occur), wrapping, `flex-basis: auto`
 * and `content`, `box-sizing: content-box`, and auto margins.
 */
export function resolveFlex(
  containerWidth: number,
  items: readonly FlexItem[],
  gap = 0,
): FlexResult {
  const available = containerWidth - gap * Math.max(0, items.length - 1);
  const mins = items.map(usedMinimum);
  const innerBases = items.map(innerBase);
  const bases = items.map((item, i) => innerBases[i]! + (item.edges ?? 0));
  const hypothetical = items.map((_, i) => Math.max(bases[i]!, mins[i]!));
  const sumHypothetical = sum(hypothetical);
  const mode = sumHypothetical < available ? 'grow' : 'shrink';
  const factor = (item: FlexItem) => (mode === 'grow' ? item.grow : item.shrink);

  const frozen = items.map(
    (item, i) => factor(item) === 0 || (mode === 'shrink' && bases[i]! < hypothetical[i]!),
  );
  const frozenAtStart = frozen.flatMap((isFrozen, i) => (isFrozen ? [i] : []));
  const sizes = [...hypothetical];

  const freeSpace = () => available - sum(items.map((_, i) => (frozen[i] ? sizes[i]! : bases[i]!)));
  const initialFreeSpace = freeSpace();

  const rounds: FlexRound[] = [];
  while (frozen.includes(false)) {
    const unfrozen = items.flatMap((_, i) => (frozen[i] ? [] : [i]));
    let free = freeSpace();
    const flexSum = sum(unfrozen.map((i) => factor(items[i]!)));
    if (flexSum < 1 && Math.abs(initialFreeSpace * flexSum) < Math.abs(free))
      free = initialFreeSpace * flexSum;

    // Growing weighs by the grow factor. Shrinking weighs by shrink factor × inner base size.
    const weight = (i: number) =>
      mode === 'grow' ? items[i]!.grow : items[i]!.shrink * innerBases[i]!;
    const factorSum = sum(unfrozen.map(weight));
    const shares = items.map((_, i) =>
      frozen[i] || factorSum === 0 ? 0 : (free * weight(i)) / factorSum,
    );
    const tentative = items.map((_, i) => (frozen[i] ? sizes[i]! : bases[i]! + shares[i]!));
    const clamped = unfrozen.filter((i) => tentative[i]! < mins[i]!);

    rounds.push({ freeSpace: free, factorSum, shares, tentative, clamped });

    // Without max-width every violation is a minimum violation, so the total is never
    // negative: freeze the clamped items, or everything when nothing was clamped.
    for (const i of clamped.length > 0 ? clamped : unfrozen) {
      sizes[i] = Math.max(tentative[i]!, mins[i]!);
      frozen[i] = true;
    }
  }

  return {
    mode,
    available,
    mins,
    bases,
    innerBases,
    hypothetical,
    sumHypothetical,
    frozenAtStart,
    initialFreeSpace,
    rounds,
    sizes,
  };
}
