import * as bcrypt from 'bcrypt';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CookieOptions, Response } from 'express';
import { Redis } from 'ioredis';

import { UserService } from '@modules/user/user.service';
import { PositionService } from '@modules/position/position.service';
import { UserRoleEnum } from '@infra/shared/enum';
import { generate6DigitCodeString, idGenerator } from '@infra/helpers';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  OTP_REDIS_PREFIX,
  OTP_TTL_SECONDS,
} from './constants';

// ---------------------------------------------------------------------------
// Cookie options -- MUST match existing behaviour for backward compatibility
// ---------------------------------------------------------------------------
const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  maxAge: 31_536_000_000, // 1 year
};

const refreshTokenCookieOptions: CookieOptions = {
  ...accessTokenCookieOptions,
  httpOnly: true,
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly positionService: PositionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // -----------------------------------------------------------------------
  // Core authentication
  // -----------------------------------------------------------------------

  /**
   * Validate credentials (local strategy).
   * Returns the user entity when login + password match.
   */
  async validateUser(login: string, password: string) {
    const user = await this.userService.getByLogin(login);
    if (!user) {
      throw new BadRequestException('Invalid login.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid password');
    }

    return user;
  }

  /**
   * Validate a user by their ID (called by JWT strategies after token decode).
   */
  async validateUserById(userId: string) {
    const user = await this.userService.getOne(userId).catch(() => {
      throw new BadRequestException('Valid token with non-existent user.');
    });
    return user;
  }

  // -----------------------------------------------------------------------
  // Token generation & cookie helpers
  // -----------------------------------------------------------------------

  /**
   * Sign a JWT. Payload format: `{ sub: userId }` -- backward compatible.
   */
  private signToken(type: 'access' | 'refresh', sub: string): string {
    const payload = { sub };

    if (type === 'access') {
      return this.jwtService.sign(payload);
    }

    const jwtConfig = this.configService.getOrThrow('jwt');
    return this.jwtService.sign(payload, {
      secret: jwtConfig.refreshTokenSecret,
      expiresIn: jwtConfig.refreshTokenExpiration,
    });
  }

  /**
   * Generate access + refresh tokens, set them as cookies, and return them
   * together with the user object.
   */
  async login(user: { id: string; isActive?: boolean }, response: Response) {
    if (!(await this.isValidUser(user.id))) {
      this.clearAuthCookies(response);
      throw new UnauthorizedException();
    }

    const accessToken = this.signToken('access', user.id);
    const refreshToken = this.signToken('refresh', user.id);

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);

    return { accessToken, refreshToken, user };
  }

  /**
   * Clear auth cookies.
   */
  logout(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions);
    response.clearCookie(REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions);
  }

  /**
   * Refresh: issue a fresh pair of tokens using the refresh-token flow.
   */
  async refreshTokens(user: { id: string }, response: Response) {
    if (!(await this.isValidUser(user.id))) {
      this.clearAuthCookies(response);
      throw new UnauthorizedException();
    }

    const accessToken = this.signToken('access', user.id);
    const refreshToken = this.signToken('refresh', user.id);

    response.cookie(ACCESS_TOKEN_COOKIE, accessToken, accessTokenCookieOptions);
    response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions);

    return { accessToken, refreshToken, user };
  }

  // -----------------------------------------------------------------------
  // Current user
  // -----------------------------------------------------------------------

  async getCurrentUser(userId: string) {
    const user = await this.userService.getOne(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  // -----------------------------------------------------------------------
  // iMarket OTP flow
  // -----------------------------------------------------------------------

  /**
   * Request an OTP code. Stores the code in Redis and returns a response
   * indicating whether this is a "register" or "login" flow.
   *
   * NOTE: The response shape is kept backward-compatible so existing mobile
   * clients continue to work.
   */
  async generateOtp(phone: string) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const user = await this.userService.getImarketuserbyPhone(cleanPhone);
    const code = generate6DigitCodeString();
    const cacheKey = `${OTP_REDIS_PREFIX}${cleanPhone}`;

    if (!user) {
      // New user -- will be registered on confirm
      const cacheData = { phone: cleanPhone, code };
      await this.redis.set(cacheKey, JSON.stringify(cacheData), 'EX', OTP_TTL_SECONDS);
      return {
        message: `Code sent to phone: ${cleanPhone}`,
        type: 'register',
        code, // TEST MODE: SMS ulanmagan, code response da qaytadi
      };
    }

    // Existing user
    const cacheData = { phone: cleanPhone, code, id: user.id };
    await this.redis.set(cacheKey, JSON.stringify(cacheData), 'EX', OTP_TTL_SECONDS);
    return {
      message: `Code sent to phone: ${cleanPhone}`,
      type: 'login',
      code, // TEST MODE: SMS ulanmagan, code response da qaytadi
    };
  }

  /**
   * Confirm OTP code. Either registers a new client or logs in an existing one.
   * Returns an access token (backward-compatible with existing mobile clients).
   */
  async validateIMarketUser(phone: string, code: string) {
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const cacheKey = `${OTP_REDIS_PREFIX}${cleanPhone}`;
    const cached = await this.redis.get(cacheKey);

    if (!cached) {
      throw new BadRequestException("Qayta Ro'yhatdan o'ting!");
    }

    const data = JSON.parse(cached);
    if (code !== data.code) {
      throw new BadRequestException(
        "Ko'd noto'g'ri iltimos to'g'ri ko'dni kirg'azing!",
      );
    }

    if (!data?.id) {
      // Register new client
      const userData = {
        login: idGenerator(),
        phone: cleanPhone,
        position: await this.positionService.getOneByRole(UserRoleEnum.CLIENT),
        password: await bcrypt.hash(cleanPhone, 10),
      };
      const user = await this.userService.createClient(userData);
      return { token: this.signToken('access', user.id), type: 'login' };
    }

    // Existing user
    return { token: this.signToken('access', data.id), type: 'login' };
  }

  /**
   * Get iMarket user profile from a raw token.
   * Kept for backward compatibility with `GET /auth/get/I-Market/me`.
   */
  async getMeIMarket(token: string) {
    if (!token) {
      throw new UnauthorizedException('Token not provided');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userService.getOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.isActive) {
      throw new ForbiddenException('User is inactive');
    }
    if (user.position.role !== UserRoleEnum.CLIENT) {
      throw new ForbiddenException('User is not a client');
    }

    const { password: _, filial: __, ...safeUser } = user as any;
    return safeUser;
  }

  // -----------------------------------------------------------------------
  // Helpers (kept public for backward compatibility -- used by old getJWT callers)
  // -----------------------------------------------------------------------

  /**
   * @deprecated Use `signToken` via `login()` / `refreshTokens()` instead.
   * Kept public so that any external callers continue to work during migration.
   */
  getJWT(type: 'access' | 'refresh', sub: string): string {
    return this.signToken(type, sub);
  }

  async isValidUser(id: string): Promise<boolean> {
    const user = await this.userService.getOne(id);
    return !!user?.isActive;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  private clearAuthCookies(response: Response) {
    response.clearCookie(ACCESS_TOKEN_COOKIE, accessTokenCookieOptions);
    response.clearCookie(REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions);
  }
}
