export interface Lesson {
  name: string;
  start: string; // "HH:MM", 24-hour
  end: string;
}

// Every caller of nextLesson assumes the timetable is sorted by start.
export function addLesson(timetable: Lesson[], lesson: Lesson): Lesson[] {
  // Two lessons overlap when each starts before the other ends.
  const clash = timetable.find((other) => lesson.start < other.end && other.start < lesson.end);
  if (clash) throw new Error(`${lesson.name} overlaps ${clash.name}`);
  return [...timetable, lesson].toSorted((a, b) => a.start.localeCompare(b.start));
}
