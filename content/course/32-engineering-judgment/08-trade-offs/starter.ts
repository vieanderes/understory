// All amounts in pounds.
export interface Build {
  upfront: number; // paid once, before year 1
  perYear: number; // upkeep, paid every year from year 1
}

export interface Buy {
  perUserPerMonth: number;
  users: number[]; // users[0] is members in year 1, users[1] in year 2, ...
}

export function breakEvenYear(build: Build, buy: Buy): number | null {
  // Never finds the year buying overtakes building.
  return null;
}
