// Borrows a client from the pool, runs `work` with it, and returns what `work` returns.
// The client must go back to the pool every time, even when `work` throws.
async function withClient(pool, work) {
  const client = await pool.connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}
