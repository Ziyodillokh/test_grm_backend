import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

import { AuthService } from '../auth.service';
import {
  JWT_REFRESH_STRATEGY,
  REFRESH_TOKEN_COOKIE,
} from '../constants';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  JWT_REFRESH_STRATEGY,
) {
  constructor(
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const jwtConfig = configService.getOrThrow('jwt');
    super({
      jwtFromRequest: (req: Request) => req?.cookies?.[REFRESH_TOKEN_COOKIE] ?? null,
      ignoreExpiration: false,
      secretOrKey: jwtConfig.refreshTokenSecret,
    });
  }

  async validate(payload: { sub: string }) {
    return this.authService.validateUserById(payload.sub);
  }
}
