function planTrip({ from, to, stops = [] }, ...extraStops) {
  // A new array and a new object, so the trip the caller holds never changes.
  return { from, to, stops: [...stops, ...extraStops] };
}
