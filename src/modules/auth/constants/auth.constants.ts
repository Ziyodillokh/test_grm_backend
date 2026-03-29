/** Cookie name for the access token -- DO NOT change, existing clients depend on it. */
export const ACCESS_TOKEN_COOKIE = 'access_token_user';

/** Cookie name for the refresh token -- DO NOT change, existing clients depend on it. */
export const REFRESH_TOKEN_COOKIE = 'refresh_token_user';

/** Passport strategy identifiers */
export const JWT_ACCESS_STRATEGY = 'jwt-access';
export const JWT_REFRESH_STRATEGY = 'jwt-refresh';
export const LOCAL_STRATEGY = 'local';

/** Redis key prefix for OTP codes */
export const OTP_REDIS_PREFIX = 'user:';

/** OTP time-to-live in seconds */
export const OTP_TTL_SECONDS = 180;
