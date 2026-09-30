export const SIZES = ['small', 'medium', 'large', 'xl'] as const;
export type Size = (typeof SIZES)[number];

// Each table must have an entry for every size in SIZES.
export const PRICES = { small: 45, medium: 120, large: 300 } satisfies Record<Size, number>;
export const LABELS = { small: 'S', medium: 'M', large: 'L' } satisfies Record<Size, string>;

export function sizeLabel(size: Size): string {
  return `${LABELS[size]}: £${PRICES[size]}`;
}
