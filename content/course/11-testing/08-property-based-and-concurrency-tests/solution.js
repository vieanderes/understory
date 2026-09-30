export function sortScores(scores) {
  return [...scores].sort((a, b) => b - a);
}

// 200 lists of scores from 0 to 120, made up by a seeded generator: the same every run.
export function randomLists(count) {
  let seed = 7;
  const next = () => (seed = (seed * 16807) % 2147483647);
  const lists = [];
  for (let i = 0; i < count; i++) {
    const list = [];
    const length = next() % 9;
    for (let j = 0; j < length; j++) list.push(next() % 121);
    lists.push(list);
  }
  return lists;
}

export function checkSortProperties() {
  for (const scores of randomLists(200)) {
    const sorted = sortScores(scores);
    expect(sorted).toHaveLength(scores.length);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1] >= sorted[i]).toBe(true);
    for (const score of scores) expect(sorted).toContain(score);
  }
}
