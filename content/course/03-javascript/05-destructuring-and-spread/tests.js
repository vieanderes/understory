test('adds one extra stop to a trip with none', () => {
  expect(planTrip({ from: 'Leeds', to: 'York' }, 'Tadcaster')).toEqual({
    from: 'Leeds',
    to: 'York',
    stops: ['Tadcaster'],
  });
});

test('adds several extra stops, after the ones already planned', () => {
  const trip = { from: 'Bath', to: 'Bristol', stops: ['Keynsham'] };
  expect(planTrip(trip, 'Saltford', 'Brislington').stops).toEqual([
    'Keynsham',
    'Saltford',
    'Brislington',
  ]);
});

test('a trip with no stops and no extras gets an empty list', () => {
  expect(planTrip({ from: 'Hull', to: 'Beverley' }).stops).toEqual([]);
});

test('does not change the trip it was given', () => {
  const stops = Object.freeze(['Keynsham']);
  const trip = Object.freeze({ from: 'Bath', to: 'Bristol', stops });
  planTrip(trip, 'Saltford');
  expect(trip.stops).toEqual(['Keynsham']);
});

test('returns a new stops list, not the old one', () => {
  const trip = { from: 'Bath', to: 'Bristol', stops: ['Keynsham'] };
  expect(planTrip(trip).stops).not.toBe(trip.stops);
});

test('keeps only from, to and stops', () => {
  const trip = { from: 'Ely', to: 'Cambridge', stops: [] };
  expect(Object.keys(planTrip(trip)).sort()).toEqual(['from', 'stops', 'to']);
});
