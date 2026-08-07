import 'reflect-metadata';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permissions.decorator';
import type { PermissionMap } from '../constants/permission-modules';

/**
 * The guard that decides whether an admin may touch a module.
 *
 * It had **no tests at all**, which is the gap the audit rule "never mark security
 * completed without authorization tests" exists to catch. A live 403 suite against
 * real tokens is still T-08 and still BLOCKED on credentials — but the decision
 * logic itself needs no server, no database and no token, so there is no reason
 * for it to have been untested.
 *
 * These cases pin behaviour that is easy to break by accident, especially the
 * default-allow on unannotated handlers and the strict `=== true` check.
 */

const ctx = (required: RequiredPermission | undefined, adminUser: unknown): ExecutionContext =>
  ({
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ adminUser }) }),
  }) as unknown as ExecutionContext;

const guardFor = (required: RequiredPermission | undefined) => {
  const reflector = {
    getAllAndOverride: (key: string) => (key === PERMISSION_KEY ? required : undefined),
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

const admin = (permissions: PermissionMap) => ({ role: { permissionsJson: permissions } });

const FULL: PermissionMap = {
  bookings: { read: true, write: true },
  donations: { read: true, write: false },
};

const NEED_WRITE: RequiredPermission = { module: 'bookings', action: 'write' };
const NEED_READ: RequiredPermission = { module: 'donations', action: 'read' };

describe('RolesGuard', () => {
  describe('when the handler declares no permission', () => {
    it('allows the request — the route is guarded elsewhere, or is public', () => {
      // Documented default-allow. If this ever needs to become default-deny, it is
      // a deliberate change: every unannotated admin route would start 403-ing.
      expect(guardFor(undefined).canActivate(ctx(undefined, undefined))).toBe(true);
    });
  });

  describe('when a permission is required', () => {
    it('allows an admin holding exactly that permission', () => {
      expect(guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, admin(FULL)))).toBe(true);
    });

    it('denies an anonymous request — no adminUser on the request', () => {
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, undefined))).toThrow(
        ForbiddenException,
      );
    });

    it('denies when the role grants nothing for that module', () => {
      expect(() =>
        guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, admin({ users: { read: true, write: true } }))),
      ).toThrow(ForbiddenException);
    });

    it('denies read-only access to a write action — the read/write split is real', () => {
      const readOnly = admin({ bookings: { read: true, write: false } });
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, readOnly))).toThrow(
        ForbiddenException,
      );
    });

    it('allows a read action backed by read permission even when write is denied', () => {
      expect(guardFor(NEED_READ).canActivate(ctx(NEED_READ, admin(FULL)))).toBe(true);
    });

    it('denies an admin whose role carries no permissions object at all', () => {
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, { role: {} }))).toThrow(
        ForbiddenException,
      );
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, {}))).toThrow(
        ForbiddenException,
      );
    });

    it('requires the permission to be literally true, not merely truthy', () => {
      // Guards against a permissions blob arriving from JSON as "true"/1/"yes".
      // A string is truthy; treating it as a grant would silently widen access.
      for (const value of ['true', 1, 'yes', {}] as unknown[]) {
        const sloppy = { role: { permissionsJson: { bookings: { write: value } } } };
        expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, sloppy))).toThrow(
          ForbiddenException,
        );
      }
    });

    it('denies rather than crashing when the module entry is null', () => {
      const broken = { role: { permissionsJson: { bookings: null } } };
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, broken))).toThrow(
        ForbiddenException,
      );
    });

    it('has no implicit superadmin bypass — the role must actually carry the permission', () => {
      const superadmin = { role: { name: 'superadmin', permissionsJson: {} } };
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, superadmin))).toThrow(
        ForbiddenException,
      );
    });

    it('answers in Arabic, matching the rest of the API surface', () => {
      expect(() => guardFor(NEED_WRITE).canActivate(ctx(NEED_WRITE, undefined))).toThrow(
        'صلاحيات غير كافية',
      );
    });
  });
});
