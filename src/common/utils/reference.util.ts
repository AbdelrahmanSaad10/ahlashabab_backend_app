/**
 * Generate a unique human-readable reference code.
 * Format: AS-XXXXXX (6-digit random number)
 */
export function generateReference(prefix = 'AS'): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${num}`;
}
