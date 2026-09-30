export type Method = 'standard' | 'express' | 'collection';

interface ShippingRule {
  cost(grams: number): number;
  days: number;
}

const halfKilos = (grams: number) => Math.ceil(grams / 500);

// Each method's rules live together, so a new method is one new entry.
export const rules: Record<Method, ShippingRule> = {
  standard: { cost: (grams) => 300 + halfKilos(grams) * 100, days: 3 },
  express: { cost: (grams) => 900 + halfKilos(grams) * 150, days: 1 },
  collection: { cost: () => 0, days: 0 },
};

export function quote(method: Method, grams: number): { cost: number; days: number } {
  const rule = rules[method];
  return { cost: rule.cost(grams), days: rule.days };
}
