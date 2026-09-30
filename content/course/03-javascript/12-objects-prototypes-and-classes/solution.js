class Playlist {
  constructor(name) {
    this.name = name;
    // Made here, so every playlist gets an array of its own.
    this.songs = [];
  }

  add(title, seconds) {
    this.songs.push({ title, seconds });
    return this.songs.length;
  }

  totalMinutes() {
    let seconds = 0;
    for (const song of this.songs) {
      seconds += song.seconds;
    }
    return Math.floor(seconds / 60);
  }
}
