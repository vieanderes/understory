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
  // This hands out the method on its own. Keep the watchlist with it.
  return watchlist.add;
}
