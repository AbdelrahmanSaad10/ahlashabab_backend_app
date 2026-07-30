/**
 * Normalize an email address: trim whitespace and lowercase.
 * "Test@Example.COM" → "test@example.com"
 * "  test@example.com  " → "test@example.com"
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
