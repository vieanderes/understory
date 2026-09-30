async function sendJson(url, data) {
  // The server can't read this body, and a failure goes unnoticed.
  const response = await fetch(url, { method: "POST", body: data });
  return response.json();
}
