export type Method = 'standard' | 'express' | 'collection';

// Adding a method means editing both switches. Move each method's rules into one place.
export function quote(method: Method, grams: number): { cost: number; days: number } {
  let cost = 0;
  switch (method) {
    case 'standard':
      cost = 300 + Math.ceil(grams / 500) * 100;
      break;
    case 'express':
      cost = 900 + Math.ceil(grams / 500) * 150;
      break;
    case 'collection':
      cost = 0;
      break;
  }
  let days = 0;
  switch (method) {
    case 'standard':
      days = 3;
      break;
    case 'express':
      days = 1;
      break;
    case 'collection':
      days = 0;
      break;
  }
  return { cost, days };
}
