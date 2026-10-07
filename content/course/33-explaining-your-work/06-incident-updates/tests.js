const live = {
  impact: 'about 1 in 3 episode uploads fail',
  status: 'investigating',
  doing: 'rolling back the storage change',
  now: '10:05',
  everyMinutes: 30,
};

test('writes the four parts in order, with a clock time', () => {
  expect(writeUpdate(live)).toBe(
    'Impact: about 1 in 3 episode uploads fail\n' +
      'Status: investigating\n' +
      'Now: rolling back the storage change\n' +
      'Next update: 10:35 UTC',
  );
});

test('pads hours and minutes to two digits', () => {
  const update = writeUpdate({ ...live, now: '08:55', everyMinutes: 10 });
  expect(update.split('\n')[3]).toBe('Next update: 09:05 UTC');
});

test('wraps the next update past midnight', () => {
  const update = writeUpdate({ ...live, now: '23:50', everyMinutes: 30 });
  expect(update.split('\n')[3]).toBe('Next update: 00:20 UTC');
});

test('ends a resolved update without promising another', () => {
  const update = writeUpdate({ ...live, status: 'resolved', doing: 'watching uploads' });
  expect(update.split('\n')).toEqual([
    'Impact: about 1 in 3 episode uploads fail',
    'Status: resolved',
    'Now: watching uploads',
    'No more updates. A summary follows.',
  ]);
});

test('refuses an update with no impact', () => {
  expect(() => writeUpdate({ ...live, impact: undefined })).toThrow('Impact first');
});

test('refuses an impact that is only spaces', () => {
  expect(() => writeUpdate({ ...live, impact: '   ' })).toThrow('Impact first');
});
