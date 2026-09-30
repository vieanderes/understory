function searchUrl(query, page = 1) {
  // encodeURIComponent turns & and spaces into codes, so they stay part of the text.
  return "/search?q=" + encodeURIComponent(query) + "&page=" + page;
}
