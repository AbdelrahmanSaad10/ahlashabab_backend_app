import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, RequiredPermission } from '../decorators/permissions.decorator';
import { PermissionMap } from '../constants/permission-modules';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const adminUser = request.adminUser;

    if (!adminUser) {
      throw new ForbiddenException('صلاحيات غير كافية');
    }

    const permissions: PermissionMap = adminUser.role?.permissionsJson ?? {};
    const modulePerms = permissions[required.module];

    if (!modulePerms) {
      throw new ForbiddenException('صلاحيات غير كافية');
    }

    const hasPermission = modulePerms[required.action] === true;

    if (!hasPermission) {
      throw new ForbiddenException('صلاحيات غير كافية');
    }

    return true;
  }
}
