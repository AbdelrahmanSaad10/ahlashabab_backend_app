/**
 * Whether the seed may overwrite rows that an administrator can edit.
 *
 * `deploy.yml` runs `npx prisma db seed` on EVERY push to main. Several seeds
 * used to upsert with a populated `update:` branch, so every deploy silently
 * reset admin-authored data back to the bundled defaults:
 *
 *   - the entire CMS document (settings, menu, home, pages, payment methods,
 *     consultation types) — destroying everything authored in the dashboard CMS;
 *   - `Role.permissionsJson` — a role an admin had *tightened* was widened back
 *     to defaults, which is a security regression, not just lost content;
 *   - category/service/provider/FAQ/foundation-stat text, and provider `rating`
 *     and `reviews`, which are derived values the seed has no business asserting.
 *
 * Default is now PRESERVE: a row is created with the bundled defaults if it does
 * not exist, and left alone if it does. Structural changes reach production
 * through the CMS migrations (backfill-on-read), which is what they are for —
 * seeds initialise, migrations repair.
 *
 * Set `SEED_OVERWRITE_CONTENT=true` for the old behaviour when you deliberately
 * want to push bundled content over live rows. It is opt-in precisely because it
 * is destructive.
 */
export const SEED_OVERWRITE_CONTENT = process.env.SEED_OVERWRITE_CONTENT === 'true';

/**
 * Wraps the `update:` branch of an upsert for admin-editable data.
 *
 * `upsert({ where, update: preserve({...}), create })` keeps the row untouched
 * when it already exists, unless overwriting is explicitly enabled.
 *
 * Do NOT use for pure reference data that no admin edits (e.g. governorate
 * ordering) — that should stay authoritative from the seed.
 */
export function preserve<T extends Record<string, unknown>>(update: T): T | Record<string, never> {
  return SEED_OVERWRITE_CONTENT ? update : {};
}

/** One-line banner so a deploy log states which mode ran. */
export function logSeedMode(): void {
  console.log(
    SEED_OVERWRITE_CONTENT
      ? '  ⚠ SEED_OVERWRITE_CONTENT=true — bundled defaults will OVERWRITE admin-edited rows'
      : '  · preserving admin-edited rows (set SEED_OVERWRITE_CONTENT=true to overwrite)',
  );
}
