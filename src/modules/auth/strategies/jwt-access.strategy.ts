import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Request } from 'express';

import { AuthService } from '../auth.service';
import {
  ACCESS_TOKEN_COOKIE,
  JWT_ACCESS_STRATEGY,
} from '../constants';

/**
 * Extracts the JWT access token from:
 *  1. The `access_token_user` cookie (existing behaviour), OR
 *  2. The Authorization Bearer header (API clients).
 */
function extractJwt(req: Request): string | null {
  // 1) Cookie (backward-compatible)
  const fromCookie = req?.cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
  if (fromCookie) return fromCookie;

  // 2) Bearer header
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  return fromHeader;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  JWT_ACCESS_STRATEGY,
) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const jwtConfig = configService.getOrThrow('jwt');
    super({
      jwtFromRequest: extractJwt,
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessTokenSecret,
    });
  }

  /**
   * Passport calls this after the JWT is verified.
   * Return value is attached to `request.user`.
   */
  async validate(payload: { sub: string }) {
    return this.authService.validateUserById(payload.sub);
  }
}
