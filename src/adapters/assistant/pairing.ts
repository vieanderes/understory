import * as z from '@/core/zod';

/*
 * The pairing code joins a simulator tab to the Claude app the candidate connected over
 * MCP. The panel makes it (so it shows at once, with no round trip) and the app passes it
 * with every tool call. Eight characters from 31 unambiguous ones: about 40 bits, enough
 * that nobody lands on another candidate's session by guessing.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export const pairingCodeSchema = z
  .string()
  .transform((value) => normalisePairingCode(value))
  .pipe(z.string().regex(new RegExp(`^[${ALPHABET}]{${LENGTH}}$`), 'Not a pairing code.'));

/** Models and people retype codes in lower case, with spaces or a dash in the middle. */
export function normalisePairingCode(value: string): string {
  return value.toUpperCase().replace(/[\s-]/g, '');
}

export function createPairingCode(
  random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b),
): string {
  const bytes = random(new Uint8Array(LENGTH));
  let code = '';
  // 31 does not divide 256, so bytes past the last whole multiple are redrawn to keep
  // every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  for (const byte of bytes) {
    let value = byte;
    while (value >= limit) value = random(new Uint8Array(1))[0] ?? 0;
    code += ALPHABET[value % ALPHABET.length];
  }
  return code;
}

/** Shown as ABCD-EFGH so it can be read aloud and retyped. */
export function formatPairingCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/*
 * The tab's secret: the second half of the pairing. The code is read aloud and pasted into
 * Claude; the secret never leaves this tab. The bridge serves the tab's side (asking,
 * reading replies, allowing a connection) only with it, so a code seen in a chat or over a
 * shoulder cannot be used to plant a question or read the conversation. 256 bits.
 */
export function createTabSecret(
  random: (bytes: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b),
): string {
  const bytes = random(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const tabSecretSchema = z.string().regex(/^[0-9a-f]{64}$/, 'Not a tab secret.');

/** The tab sends both in headers, so neither lands in a URL or an access log. */
export const PAIRING_HEADER = 'x-pairing-code';
export const TAB_SECRET_HEADER = 'x-tab-secret';

export interface Pairing {
  code: string;
  secret: string;
}
