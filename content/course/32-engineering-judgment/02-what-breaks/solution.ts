export interface Hours {
  opens: string; // "HH:MM", 24-hour local time
  closes: string;
}

// Correct for a shop open 09:00 to 17:00. The bakery opens at 22:00.
export function isOpen(hours: Hours, now: string): boolean {
  const { opens, closes } = hours;
  if (opens === closes) return true;
  // Zero-padded "HH:MM" strings compare in the same order as the times they show.
  if (opens < closes) return now >= opens && now < closes;
  // Past midnight: open late in the evening, or early in the morning.
  return now >= opens || now < closes;
}
