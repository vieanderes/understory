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
  let built = build.upfront;
  let bought = 0;
  for (const [index, members] of buy.users.entries()) {
    built += build.perYear;
    bought += buy.perUserPerMonth * 12 * members;
    if (bought > built) return index + 1;
  }
  return null;
}
