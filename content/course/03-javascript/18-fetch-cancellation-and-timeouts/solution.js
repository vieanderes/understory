async function sendJson(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // A body travels as text, so the object becomes JSON first.
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Sending to ${url} failed with status ${response.status}`);
  }
  return response.json();
}
