// Reads a value back out of the query string, the way a server would.
function read(url, name) {
  const query = url.slice(url.indexOf("?") + 1);
  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    if (key === name) return decodeURIComponent(value.replaceAll("+", " "));
  }
  return undefined;
}

test("asks for the /search path", () => {
  expect(searchUrl("tea", 1).startsWith("/search?")).toBe(true);
});

test("sends a plain query and page", () => {
  const url = searchUrl("tea", 3);
  expect(read(url, "q")).toBe("tea");
  expect(read(url, "page")).toBe("3");
});

test("keeps an & inside the query", () => {
  expect(read(searchUrl("fish & chips", 2), "q")).toBe("fish & chips");
});

test("keeps a + inside the query", () => {
  expect(read(searchUrl("c++ books", 1), "q")).toBe("c++ books");
});

test("uses page 1 when the page is left out", () => {
  expect(read(searchUrl("tea"), "page")).toBe("1");
});
