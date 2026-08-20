-- A slot may be held by at most one booking that has not been cancelled.
--
-- T-09 proved the application already refuses a concurrent double-booking: two
-- simultaneous identical requests leave exactly one row, and a five-way burst
-- also leaves one. That guarantee lives in a Serializable transaction in
-- BookingsService — which is to say, it protects the one path that goes through
-- it. Nothing stopped a duplicate arriving any other way.
--
-- Why partial, and not @@unique([providerId, date, timeSlot]):
--   cancelled bookings keep their rows, so cancel-and-rebook legitimately
--   produces two rows for one slot. A plain unique constraint rejects the
--   rebooking — it would break a working feature to guard against one that
--   already works. Prisma cannot express `WHERE` on an index, hence raw SQL.
--
-- Why not CONCURRENTLY:
--   CREATE INDEX CONCURRENTLY cannot run inside a transaction, and Prisma wraps
--   every migration in one. It is the right choice on a large live table; this
--   one holds zero rows (verified on production before writing this), so the
--   lock is instantaneous and the plain form is correct.
--
-- Known drift: Prisma's datamodel cannot describe a partial index, so
-- `migrate diff` will report this index as an extra object. That is expected —
-- see prisma/migrations/README.md.
CREATE UNIQUE INDEX "booking_slot_unique"
  ON "bookings" ("provider_id", "date", "time_slot")
  WHERE "status" <> 'ملغي';
