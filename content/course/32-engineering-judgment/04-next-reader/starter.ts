export interface Lesson {
  name: string;
  start: string; // "HH:MM", 24-hour
  end: string;
}

// Every caller of nextLesson assumes the timetable is sorted by start.
export function addLesson(timetable: Lesson[], lesson: Lesson): Lesson[] {
  return [...timetable, lesson];
}
