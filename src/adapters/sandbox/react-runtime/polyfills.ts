/**
 * Injected by esbuild in place of the globals of the same name wherever the bundled
 * libraries use them (scripts/build-sandbox.ts, `inject`). A Web Worker has these; the
 * `node:vm` context of the CI gate does not. Using the same code in both keeps the two
 * runtimes identical and the learner's globals unchanged.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 to a binary string. `entities` decodes its tables with it at load time. */
export function atob(input: string): string {
  const clean = String(input).replace(/[\s=]+/g, '');
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error('atob: invalid base64');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}
