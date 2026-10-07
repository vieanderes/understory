export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isObject(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Apply an RFC 7396 merge patch and return the new document. Leave `target` unchanged.
export function applyMergePatch(target: Json, patch: Json): Json {
  // Anything but an object replaces the target whole: a string, a number, an array.
  if (!isObject(patch)) return patch;
  const result: { [key: string]: Json } = isObject(target) ? { ...target } : {};
  for (const [name, value] of Object.entries(patch)) {
    if (value === null) delete result[name];
    else result[name] = applyMergePatch(result[name] ?? null, value);
  }
  return result;
}
