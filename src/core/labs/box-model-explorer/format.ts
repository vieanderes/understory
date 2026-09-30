/** A pixel figure with at most two decimals and no trailing zeros: 106.67, 96, 22.4. */
export function px(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  // -0 would print as "0" anyway, but a true minus sign reads better than a hyphen.
  return (Object.is(rounded, -0) ? 0 : rounded).toString().replace('-', '−');
}
