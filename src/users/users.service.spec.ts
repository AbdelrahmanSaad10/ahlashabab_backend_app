import 'reflect-metadata';
import { UsersService } from './users.service';

/**
 * Ownership scoping for the `/me/*` surface.
 *
 * A real IDOR suite — user A calling the API with user B's ids and getting 404
 * rather than 200 — is T-08, and it is **BLOCKED** on the two user tokens in
 * T-06. This is not that test, and does not replace it.
 *
 * What it does cover is the half that needs no server: that every user-scoped
 * query actually carries `userId` into the `where` clause. Dropping that filter
 * is a one-line mistake with a very large blast radius — every user would see
 * every other user's bookings, donations, consultations and favourites — and it
 * would look completely normal in review. These tests capture the Prisma args
 * and assert the filter is present and correct.
 */

type Call = { model: string; op: string; args: any };

function build() {
  const calls: Call[] = [];
  const record = (model: string, op: string) => async (args: any) => {
    calls.push({ model, op, args });
    return [];
  };
  const prisma: any = {
    booking: { findMany: record('booking', 'findMany') },
    donation: { findMany: record('donation', 'findMany') },
    consultationRequest: { findMany: record('consultationRequest', 'findMany') },
    favorite: {
      findMany: record('favorite', 'findMany'),
      upsert: record('favorite', 'upsert'),
      deleteMany: record('favorite', 'deleteMany'),
    },
    user: { findUnique: record('user', 'findUnique'), update: record('user', 'update') },
    deviceToken: { upsert: record('deviceToken', 'upsert') },
  };
  return { svc: new UsersService(prisma), calls };
}

const A = 'user-a';
const B = 'user-b';

describe('UsersService — every /me read is scoped to the caller', () => {
  const reads: [string, (s: UsersService) => Promise<unknown>][] = [
    ['bookings', (s) => s.getUserBookings(A)],
    ['donations', (s) => s.getUserDonations(A)],
    ['consultations', (s) => s.getUserConsultations(A)],
    ['favorites', (s) => s.getFavorites(A)],
  ];

  it.each(reads)('%s filters on the caller’s userId', async (_name, run) => {
    const { svc, calls } = build();
    await run(svc);
    expect(calls).toHaveLength(1);
    expect(calls[0].args.where).toMatchObject({ userId: A });
  });

  it('never queries without a userId filter — the IDOR shape', async () => {
    const { svc, calls } = build();
    await Promise.all(reads.map(([, run]) => run(svc)));
    for (const c of calls) {
      expect(c.args?.where?.userId).toBe(A);
    }
  });

  it('asking as user B cannot return user A’s rows', async () => {
    const { svc, calls } = build();
    await svc.getUserBookings(B);
    expect(calls[0].args.where.userId).toBe(B);
    expect(calls[0].args.where.userId).not.toBe(A);
  });
});

describe('UsersService — favourites are keyed by owner', () => {
  it('adds against the caller’s composite key, not the entity alone', async () => {
    const { svc, calls } = build();
    await svc.addFavorite(A, 'case', 'c-1');
    expect(calls[0].args.where.userId_entityType_entityId).toEqual({
      userId: A, entityType: 'case', entityId: 'c-1',
    });
    expect(calls[0].args.create).toMatchObject({ userId: A });
  });

  it('removes only the caller’s row — B cannot delete A’s favourite', async () => {
    const { svc, calls } = build();
    await svc.removeFavorite(B, 'case', 'c-1');
    expect(calls[0].args.where).toEqual({ userId: B, entityType: 'case', entityId: 'c-1' });
  });
});
