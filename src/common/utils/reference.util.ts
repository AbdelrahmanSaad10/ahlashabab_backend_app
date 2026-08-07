import { randomBytes } from 'crypto';

/**
 * Human-readable reference codes for donations, bookings and consultations.
 *
 * These are not just display strings — for donations and bookings the reference
 * IS the credential: `GET /donations/:reference` and `GET /bookings/:reference`
 * are both `@Public()`, so that anyone holding a receipt can check it without an
 * account. Guessing a reference therefore means reading a stranger's record.
 *
 * The previous implementation was:
 *
 *     `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`
 *
 * which has two measured defects:
 *
 *  1. **Enumerable.** 900,000 possible values. An unauthenticated attacker can
 *     walk the whole space and harvest every donor's name and amount, and every
 *     booking's phone, age, gender and national id.
 *  2. **Collision-prone.** 10,000 generated references produced **51 duplicates**
 *     in measurement. `reference` is `@unique`, so those are failed donations
 *     and bookings. By the birthday bound there is a ~50% chance of at least one
 *     collision by roughly the 1,100th record — well inside this project's
 *     expected lifetime.
 *
 * Now: 60 bits from `crypto.randomBytes` rendered in Crockford base32, which
 * omits I, L, O and U so a code read aloud or copied by hand is unambiguous.
 * That is ~1.15e18 values — enumeration is infeasible and collisions are not a
 * practical concern.
 *
 * Existing shorter references remain valid: lookups are exact-match, so nothing
 * issued before this change stops working.
 */

/** Crockford base32 — no I, L, O or U, to survive being read over the phone. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHARS = 12;
const BITS = CHARS * 5; // 60

export function generateReference(prefix = 'AS'): string {
  // 8 bytes = 64 bits; mask down to the 60 we render.
  let n = BigInt('0x' + randomBytes(8).toString('hex')) & ((1n << BigInt(BITS)) - 1n);

  let out = '';
  for (let i = 0; i < CHARS; i++) {
    out = ALPHABET[Number(n & 31n)] + out;
    n >>= 5n;
  }
  return `${prefix}-${out}`;
}
