import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Scope } from '../enums/scope.enum';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredScopes = this.reflector.getAllAndOverride<Scope[]>(
      SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredScopes || requiredScopes.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    const userRole = user?.position?.role ?? user?.role;
    if (userRole === Role.BOSS) return true;

    const userScope = this.resolveUserScope(user);
    if (requiredScopes.includes(Scope.GLOBAL)) return true;

    return requiredScopes.includes(userScope);
  }

  private resolveUserScope(user: any): Scope {
    const role = user?.position?.role ?? user?.role;

    switch (role) {
      case Role.BOSS:
      case Role.ACCOUNTANT:
      case Role.HR:
      case Role.M_MANAGER:
        return Scope.GLOBAL;
      case Role.F_MANAGER:
      case Role.SELLER:
        return Scope.BRANCH;
      case Role.W_MANAGER:
        return Scope.WAREHOUSE;
      case Role.D_MANAGER:
      case Role.DEALER:
        return Scope.DEALER;
      case Role.I_MANAGER:
        return Scope.INTERNET;
      case Role.CLIENT:
        return Scope.SELF;
      default:
        return Scope.SELF;
    }
  }
}
