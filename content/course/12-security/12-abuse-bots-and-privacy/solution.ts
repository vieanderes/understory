export interface Bucket {
  tokens: number;
  last: number;
}

export interface Result {
  ok: boolean;
  bucket: Bucket;
}

export function take(bucket: Bucket, now: number, capacity: number, refillPerSec: number): Result {
  const elapsed = (now - bucket.last) / 1000;
  const filled = Math.min(capacity, bucket.tokens + elapsed * refillPerSec);
  if (filled >= 1) {
    return { ok: true, bucket: { tokens: filled - 1, last: now } };
  }
  return { ok: false, bucket: { tokens: filled, last: now } };
}
