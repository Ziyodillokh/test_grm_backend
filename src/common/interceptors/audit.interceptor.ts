import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY } from '../decorators/audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditAction = this.reflector.get<string>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditAction) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const url = request.url;
    const ip = request.ip || request.connection?.remoteAddress;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.log(
            JSON.stringify({
              action: auditAction,
              userId: user?.id,
              userName: user?.name,
              userRole: user?.position?.role ?? user?.role,
              method,
              url,
              ip,
              userAgent,
              duration,
              status: 'success',
              timestamp: new Date().toISOString(),
            }),
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            JSON.stringify({
              action: auditAction,
              userId: user?.id,
              userName: user?.name,
              userRole: user?.position?.role ?? user?.role,
              method,
              url,
              ip,
              userAgent,
              duration,
              status: 'error',
              error: error.message,
              timestamp: new Date().toISOString(),
            }),
          );
        },
      }),
    );
  }
}
