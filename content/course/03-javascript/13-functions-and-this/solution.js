class Watchlist {
  constructor() {
    this.films = [];
  }
  add(film) {
    this.films.push(film);
    return this.films.length;
  }
}

function addHandler(watchlist) {
  // The arrow makes the call through the watchlist, so `this` is always right.
  return (film) => watchlist.add(film);
}
