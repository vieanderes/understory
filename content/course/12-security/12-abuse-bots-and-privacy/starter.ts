export interface Bucket {
  tokens: number;
  last: number;
}

export interface Result {
  ok: boolean;
  bucket: Bucket;
}

export function take(bucket: Bucket, now: number, capacity: number, refillPerSec: number): Result {
  // Replace this. It lets every request through, so the bucket never limits anything.
  return { ok: true, bucket: { tokens: capacity, last: now } };
}
