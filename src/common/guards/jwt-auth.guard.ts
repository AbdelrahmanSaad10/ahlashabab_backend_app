import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/optional-auth.decorator';

/**
 * Expose the entity's primary key under both `id` and `sub`.
 *
 * The @CurrentUser call sites are split — five read `user.sub` (the JWT claim
 * name) and four read `user.id` (the column). Serving both keeps every existing
 * route working off one shape. Worth consolidating on `id` later; until then,
 * dropping either alias silently breaks whichever routes use it.
 */
const withSubAlias = <T extends { id: string }>(entity: T) => ({ ...entity, sub: entity.id });

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt-access') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isOptional) {
      // Try to authenticate, but don't fail if no token
      return super.canActivate(context);
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, result: any, _info: any, context: ExecutionContext) {
    const isOptional = this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isOptional && !result) {
      return null;
    }

    if (err || !result) {
      throw err || new UnauthorizedException('يجب تسجيل الدخول');
    }

    // JwtAccessStrategy resolves to `{ adminUser }` or `{ user }`, and Passport
    // assigns whatever we return here to `request.user` — so without unwrapping,
    // `request.adminUser` is never set and `request.user` is a wrapper object.
    //
    // That silently broke the whole authenticated surface: RolesGuard reads
    // `request.adminUser`, so every @RequirePermission route threw 403 no matter
    // how the role was configured, and the /me controllers read `.sub`/`.id` off
    // the wrapper and got undefined.
    const request = context.switchToHttp().getRequest();

    if (result.adminUser) {
      // CurrentAdmin, RolesGuard and ActivityLogInterceptor all read this.
      request.adminUser = result.adminUser;
      return withSubAlias(result.adminUser);
    }

    if (result.user) {
      return withSubAlias(result.user);
    }

    return result;
  }
}
