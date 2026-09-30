function searchUrl(query, page) {
  // This breaks when the query holds & or spaces.
  return "/search?q=" + query + "&page=" + page;
}
