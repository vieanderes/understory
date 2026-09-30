// The stack holds days still waiting for a warmer one, and their temperatures only fall
// from bottom to top. A warmer day answers every cooler day on top before it waits
// itself. Each day is pushed once and popped at most once, so the pass is O(n).
export function daysToWait(temps: number[]): number[] {
  const wait = new Array<number>(temps.length).fill(0);
  const waiting: { day: number; temp: number }[] = [];
  temps.forEach((temp, day) => {
    let top = waiting[waiting.length - 1];
    while (top !== undefined && top.temp < temp) {
      wait[top.day] = day - top.day;
      waiting.pop();
      top = waiting[waiting.length - 1];
    }
    waiting.push({ day, temp });
  });
  return wait;
}
