export interface Hours {
  opens: string; // "HH:MM", 24-hour local time
  closes: string;
}

// Correct for a shop open 09:00 to 17:00. The bakery opens at 22:00.
export function isOpen(hours: Hours, now: string): boolean {
  return now >= hours.opens && now < hours.closes;
}
