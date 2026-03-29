export { LoginDto } from './login.dto';
export { OtpRequestDto, OtpConfirmDto } from './otp.dto';

/**
 * Backward-compatible default export so that legacy
 *   `import { default as LoginDto } from './login.dto'`
 * style imports keep working from other modules.
 */
import { LoginDto as _LoginDto } from './login.dto';
export default _LoginDto;
