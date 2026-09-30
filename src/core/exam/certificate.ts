import type { PathExamAttempt } from '@/core/progress/reducer';

/*
 * The verification code printed on a certificate. It is a check, not security: anyone with
 * this source can compute a code for any facts. What it does is tie the printed path, date,
 * score and lessons together, so a hand-edited certificate no longer matches its code when
 * the facts are fed back in. FNV-1a (Fowler, Noll, Vo; IETF draft-eastlake-fnv) is a small,
 * well-known, non-cryptographic hash, chosen so core needs no crypto dependency.
 */

export interface CertificateFacts {
  readonly pathId: string;
  /** The learner's date of the first passing attempt, YYYY-MM-DD. */
  readonly passedOn: string;
  readonly right: number;
  readonly total: number;
  readonly lessonIds: readonly string[];
}

/** Bump when the recipe changes, so an old code is never read against the new one. */
const RECIPE = 'understory-certificate-v1';

/** Crockford's base 32: no I, L, O or U, so a code read aloud or retyped survives. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    if (cp < 0x80) bytes.push(cp);
    else if (cp < 0x800) bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000)
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 0x3f),
        0x80 | ((cp >> 6) & 0x3f),
        0x80 | (cp & 0x3f),
      );
  }
  return bytes;
}

/** 32-bit FNV-1a over the UTF-8 bytes of `text`, as an unsigned integer. */
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of utf8(text)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** 12 base-32 characters: the low 30 bits of each word, five bits a character. */
function encode(high: number, low: number): string {
  const chars: string[] = [];
  for (const word of [high, low]) {
    for (let shift = 25; shift >= 0; shift -= 5) chars.push(ALPHABET[(word >>> shift) & 31]!);
  }
  return chars.join('');
}

/** A 12-character code in three groups, for example `7K2M-QX9D-4HBT`. */
export function certificateCode(facts: CertificateFacts): string {
  const canonical = [
    RECIPE,
    facts.pathId,
    facts.passedOn,
    `${facts.right}/${facts.total}`,
    [...facts.lessonIds].sort().join(','),
  ].join('|');
  // Two salted passes give 60 usable bits, so a matching code is not found by a few edits by hand.
  const code = encode(fnv1a32(`a|${canonical}`), fnv1a32(`b|${canonical}`));
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

/** The facts a certificate states, from the attempt that first passed. */
export function certificateFacts(pathId: string, attempt: PathExamAttempt): CertificateFacts {
  return {
    pathId,
    passedOn: attempt.localDate,
    right: attempt.right,
    total: attempt.total,
    lessonIds: attempt.lessonIds,
  };
}
