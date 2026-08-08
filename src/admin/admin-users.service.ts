import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../common/utils/email.util';
import { PermissionMap } from '../common/constants/permission-modules';
import {
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from './dto/admin-user.dto';

/**
 * Administrator accounts.
 *
 * `AdminUser` rows could only be created by the seed or by hand on the database:
 * no create, no list, no disable, no password reset for anyone but yourself. The
 * foundation ran on a single administrator account, and someone who left could
 * not be locked out without psql.
 *
 * Two things this service refuses to do, both of them lockouts:
 *
 *   - remove the **last** administrator who can manage roles and accounts, by
 *     deactivating them or by moving them to a role without `roles:write`. There
 *     would then be nobody who could undo it, and the only way back would be the
 *     database — which is the situation this whole module exists to end.
 *   - let an administrator deactivate themselves. Always a mistake, never worth
 *     the round trip through support.
 *
 * Audit entries are written **here** rather than by `ActivityLogInterceptor`.
 * The interceptor stores `newValue: request.body`, and these bodies carry
 * plaintext passwords — creating an account through it would write the password
 * into the activity log. See T-06, where the same trap applied to
 * `change-password`.
 */

/** Never select `passwordHash`; nothing outside this file has any use for it. */
const PUBLIC_FIELDS = {
  id: true,
  name: true,
  email: true,
  active: true,
  roleId: true,
  providerId: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
  provider: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ----------------------------------------------------------------
  // Reads
  // ----------------------------------------------------------------

  findAll() {
    return this.prisma.adminUser.findMany({
      select: PUBLIC_FIELDS,
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const adminUser = await this.prisma.adminUser.findUnique({
      where: { id },
      select: PUBLIC_FIELDS,
    });
    if (!adminUser) throw new NotFoundException('حساب المسؤول غير موجود');
    return adminUser;
  }

  // ----------------------------------------------------------------
  // Writes
  // ----------------------------------------------------------------

  async create(dto: CreateAdminUserDto, actorId: string, context: RequestContext = {}) {
    const email = normalizeEmail(dto.email);

    const existing = await this.prisma.adminUser.findUnique({ where: { email } });
    if (existing) throw new ConflictException('يوجد حساب بهذا البريد الإلكتروني بالفعل');

    await this.assertRoleExists(dto.roleId);
    if (dto.providerId) await this.assertProviderFree(dto.providerId);

    const created = await this.prisma.adminUser.create({
      data: {
        name: dto.name,
        email,
        passwordHash: await argon2.hash(dto.password),
        roleId: dto.roleId,
        providerId: dto.providerId ?? null,
        active: true,
      },
      select: PUBLIC_FIELDS,
    });

    await this.audit(actorId, 'create', created.id, context, { email, roleId: dto.roleId });
    this.logger.log(`Admin account created: ${email}`);
    return created;
  }

  async update(
    id: string,
    dto: UpdateAdminUserDto,
    actorId: string,
    context: RequestContext = {},
  ) {
    const target = await this.prisma.adminUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!target) throw new NotFoundException('حساب المسؤول غير موجود');

    if (dto.active === false && id === actorId) {
      throw new ForbiddenException('لا يمكنك تعطيل حسابك الخاص');
    }

    if (dto.roleId) await this.assertRoleExists(dto.roleId);
    if (dto.providerId) await this.assertProviderFree(dto.providerId, id);

    /*
     * Would this change leave nobody able to manage roles and accounts?
     *
     * The `active === false` arm is defence in depth rather than a live path: the
     * only caller who could deactivate the last manager is that manager, and
     * self-deactivation is refused above. It stays because the two rules protect
     * the same thing and the cheap one should not be the only one.
     */
    const losesAdminRights =
      dto.active === false ||
      (dto.roleId !== undefined && dto.roleId !== target.roleId);

    if (losesAdminRights) {
      const stillCapable = dto.active === false ? false : await this.roleCanManage(dto.roleId!);
      if (!stillCapable) await this.assertNotLastManager(id);
    }

    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.providerId !== undefined ? { providerId: dto.providerId } : {}),
      },
      select: PUBLIC_FIELDS,
    });

    await this.audit(actorId, 'update', id, context, dto as Record<string, unknown>);
    return updated;
  }

  /**
   * Set someone else's password.
   *
   * Every refresh token for that account is revoked in the same transaction: if
   * the password is being reset because it leaked, the sessions it opened have to
   * end with it, or they survive for the 30-day refresh lifetime.
   */
  async resetPassword(
    id: string,
    newPassword: string,
    actorId: string,
    context: RequestContext = {},
  ) {
    const target = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('حساب المسؤول غير موجود');

    const passwordHash = await argon2.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id }, data: { passwordHash } }),
      this.prisma.refreshToken.updateMany({
        where: { adminUserId: id, revoked: false },
        data: { revoked: true },
      }),
      this.prisma.activityLog.create({
        data: {
          actorId,
          action: 'update',
          entityType: 'admin-password',
          entityId: id,
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
        },
      }),
    ]);

    this.logger.log(`Password reset for admin ${target.email} by ${actorId}`);
    return { message: 'تم تعيين كلمة مرور جديدة. سيلزم تسجيل الدخول من جديد.' };
  }

  // ----------------------------------------------------------------
  // Guards
  // ----------------------------------------------------------------

  private async assertRoleExists(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new BadRequestException('الدور غير موجود');
  }

  /** `providerId` is unique — a provider cannot be bound to two accounts. */
  private async assertProviderFree(providerId: string, exceptAdminId?: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new BadRequestException('مقدم الخدمة غير موجود');

    const holder = await this.prisma.adminUser.findUnique({ where: { providerId } });
    if (holder && holder.id !== exceptAdminId) {
      throw new ConflictException('مقدم الخدمة مرتبط بحساب آخر بالفعل');
    }
  }

  private async roleCanManage(roleId: string): Promise<boolean> {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    const permissions = (role?.permissionsJson ?? {}) as PermissionMap;
    return permissions.roles?.write === true;
  }

  /**
   * `roles:write` is the permission that reaches this module and the role editor.
   * If the last active holder of it loses it, nobody can grant it back and the
   * only route in is the database.
   */
  private async assertNotLastManager(id: string) {
    const actives = await this.prisma.adminUser.findMany({
      where: { active: true },
      include: { role: true },
    });

    const managers = actives.filter((a) => {
      const permissions = (a.role?.permissionsJson ?? {}) as PermissionMap;
      return permissions.roles?.write === true;
    });

    if (managers.length <= 1 && managers.some((m) => m.id === id)) {
      throw new ForbiddenException(
        'هذا هو المسؤول الوحيد الذي يملك صلاحية إدارة الأدوار والحسابات. ' +
          'عيّن مسؤولاً آخر بهذه الصلاحية أولاً.',
      );
    }
  }

  private async audit(
    actorId: string,
    action: string,
    entityId: string,
    context: RequestContext,
    newValue: Record<string, unknown>,
  ) {
    // Belt and braces: the DTOs cannot carry these, but an audit row is the last
    // place a secret should ever turn up.
    const safe = { ...newValue };
    delete safe.password;
    delete safe.newPassword;
    delete safe.passwordHash;

    await this.prisma.activityLog.create({
      data: {
        actorId,
        action,
        entityType: 'admin-users',
        entityId,
        newValue: safe as never,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  }
}

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}
