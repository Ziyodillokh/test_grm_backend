import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRoleEnum } from '@infra/shared/enum';
import { User } from '@modules/user/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<UserRoleEnum[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user }: { user: User } = context.switchToHttp().getRequest();
    if (!user) return false;

    const userRole = user?.position?.role;
    if (userRole === undefined || userRole === null) return false;

    // BOSS bypasses all role checks
    if (userRole === UserRoleEnum.BOSS) return true;

    return requiredRoles.includes(userRole);
  }
}
