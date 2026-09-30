// A stand-in server: it records each request and answers with this status and reply.
function fakeServer(status, reply) {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: status >= 200 && status < 300, status, json: async () => reply };
  };
  return requests;
}

test("sends a POST to the url", async () => {
  const requests = fakeServer(201, { id: 1 });
  await sendJson("/reviews", { stars: 5 });
  expect(requests[0].url).toBe("/reviews");
  expect(requests[0].options.method).toBe("POST");
});

test("sends the data as JSON text", async () => {
  const requests = fakeServer(201, { id: 1 });
  await sendJson("/reviews", { book: 12, stars: 5 });
  expect(requests[0].options.body).toBe('{"book":12,"stars":5}');
});

test("labels the body as JSON", async () => {
  const requests = fakeServer(201, { id: 1 });
  await sendJson("/reviews", { stars: 5 });
  expect(requests[0].options.headers["Content-Type"]).toBe("application/json");
});

test("returns the parsed reply", async () => {
  fakeServer(201, { id: 88, stars: 5 });
  expect(await sendJson("/reviews", { stars: 5 })).toEqual({ id: 88, stars: 5 });
});

test("throws with the status when the response isn't ok", async () => {
  fakeServer(500, { error: "Server error" });
  let message = "no error thrown";
  try {
    await sendJson("/reviews", { stars: 5 });
  } catch (error) {
    message = error.message;
  }
  expect(message).toContain("500");
});
