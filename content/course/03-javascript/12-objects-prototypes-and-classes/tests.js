test('a new playlist keeps its name', () => {
  expect(new Playlist('Road trip').name).toBe('Road trip');
});

test('add returns the number of songs so far', () => {
  const playlist = new Playlist('Road trip');
  expect(playlist.add('Holiday', 200)).toBe(1);
  expect(playlist.add('Home', 190)).toBe(2);
});

test('totalMinutes adds the seconds and rounds down', () => {
  const playlist = new Playlist('Road trip');
  playlist.add('Holiday', 200);
  playlist.add('Home', 190);
  expect(playlist.totalMinutes()).toBe(6);
});

test('an empty playlist lasts 0 minutes', () => {
  expect(new Playlist('Quiet').totalMinutes()).toBe(0);
});

test('two playlists never share songs', () => {
  const road = new Playlist('Road trip');
  const study = new Playlist('Study');
  road.add('Holiday', 200);
  expect(study.add('Rain', 240)).toBe(1);
  expect(study.totalMinutes()).toBe(4);
});
