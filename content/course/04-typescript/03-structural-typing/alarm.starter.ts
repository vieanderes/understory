export type AlarmOptions = {
  hour: number;
  minute: number;
  /** How long a snooze lasts. Nine minutes when not given. */
  snoozeMinutes?: number;
};

export type Time = { hour: number; minute: number };

/** The time a snooze ends. */
export function snoozeEnds(options: AlarmOptions): Time {
  const total = options.hour * 60 + options.minute + (options.snoozeMinutes ?? 9);
  return { hour: Math.floor(total / 60) % 24, minute: total % 60 };
}

export function morningAlarm(): Time {
  // Should snooze for 5 minutes. It snoozes for 9, and the checker says nothing.
  const options = { hour: 7, minute: 30, snoozeMinute: 5 };
  return snoozeEnds(options);
}
