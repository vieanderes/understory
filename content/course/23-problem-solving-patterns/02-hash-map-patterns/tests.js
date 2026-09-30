test('example: listen, silent and enlist', () => {
  expect(groupAnagrams(['listen', 'google', 'silent', 'enlist'])).toEqual([
    ['listen', 'silent', 'enlist'],
    ['google'],
  ]);
});

test('keeps groups in order of first appearance', () => {
  expect(groupAnagrams(['tab', 'eat', 'bat', 'tea'])).toEqual([
    ['tab', 'bat'],
    ['eat', 'tea'],
  ]);
});

test('an empty list gives no groups', () => {
  expect(groupAnagrams([])).toEqual([]);
});

test('repeated words land in the same group', () => {
  expect(groupAnagrams(['dog', 'dog'])).toEqual([['dog', 'dog']]);
});

test('words of different lengths never share a group', () => {
  expect(groupAnagrams(['a', 'aa'])).toEqual([['a'], ['aa']]);
});

test('performance: 100,000 words', () => {
  const words = [];
  for (let i = 0; i < 100000; i++) {
    let n = i;
    let word = '';
    for (let k = 0; k < 6; k++) {
      word += String.fromCharCode(97 + (n % 26));
      n = Math.floor(n / 26);
    }
    words.push(word);
  }
  words.push('baaaaa');
  const groups = groupAnagrams(words);
  expect(groups[0]).toEqual(['aaaaaa']);
  expect(groups[1]).toEqual(['baaaaa', 'abaaaa', 'aabaaa', 'aaabaa', 'baaaaa']);
  expect(groups).toHaveLength(14773);
});
