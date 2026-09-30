function fullestBucket(keys, bucketCount) {
  // The toy hash is the key's length. Count how many keys land in each bucket, then take the most.
  const sizes = new Map();
  let fullest = 0;
  for (const key of keys) {
    const bucket = key.length % bucketCount;
    let size = 1;
    if (sizes.has(bucket)) {
      size = sizes.get(bucket) + 1;
    }
    sizes.set(bucket, size);
    if (size > fullest) {
      fullest = size;
    }
  }
  return fullest;
}
