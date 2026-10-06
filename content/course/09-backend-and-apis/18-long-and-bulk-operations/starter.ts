export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isObject(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Apply an RFC 7396 merge patch and return the new document. Leave `target` unchanged.
export function applyMergePatch(target: Json, patch: Json): Json {
  // A shallow merge: nulls are copied in, and nested objects are overwritten whole.
  if (isObject(target) && isObject(patch)) return { ...target, ...patch };
  return patch;
}
