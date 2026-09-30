const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Turns base64url text back into the text it encodes, like the browser's atob.
function fromBase64Url(part: string): string {
  let bits = '';
  for (const ch of part) bits += ALPHABET.indexOf(ch).toString(2).padStart(6, '0');
  let text = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    text += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2));
  }
  return text;
}

export function readPayload(token: string): Record<string, unknown> {
  // Replace this: check there are three parts, then decode and parse the middle one.
  return {};
}
