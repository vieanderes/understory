import { checkSortProperties } from './solution';

// Your code and these checks run as one script, so this is your `sortScores`. Each check
// swaps in a broken copy, runs your properties, then puts the real one back.
const real = sortScores;

function failureOf(version) {
  sortScores = version;
  try {
    checkSortProperties();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    sortScores = real;
  }
}

function expectCaught(version, hint) {
  if (failureOf(version) === null) throw new Error(`Your properties still hold. ${hint}`);
}

test('your properties hold for the real sortScores', () => {
  const failure = failureOf(real);
  if (failure !== null) throw new Error(`They fail on working code: ${failure}`);
});

test('they catch a sort that drops repeated scores', () => {
  expectCaught((scores) => [...new Set(scores)].sort((a, b) => b - a), 'Compare the lengths.');
});

test('they catch a sort that compares scores as text', () => {
  expectCaught((scores) => [...scores].sort().reverse(), 'Check each score against the next.');
});

test('they catch a sort that loses one score and repeats another', () => {
  expectCaught((scores) => {
    const sorted = [...scores].sort((a, b) => b - a);
    if (sorted.length > 1) sorted[1] = sorted[0];
    return sorted;
  }, 'Check that every original score is still there.');
});
