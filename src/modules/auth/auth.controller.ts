import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as dayjs from 'dayjs';

import { AuthService } from './auth.service';
import { LoginDto, OtpRequestDto, OtpConfirmDto } from './dto';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { User } from '@modules/user/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // -----------------------------------------------------------------------
  // POST /auth/login
  // -----------------------------------------------------------------------
  @Public()
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with login + password' })
  @ApiOkResponse({ description: 'Access and refresh tokens returned and set as cookies.' })
  @ApiBadRequestResponse({ description: 'Invalid credentials.' })
  async login(
    @Req() { user }: { user: User },
    @Res({ passthrough: true }) response: Response,
    @Body() _dto: LoginDto,
  ) {
    return this.authService.login(user, response);
  }

  // -----------------------------------------------------------------------
  // POST /auth/logout
  // -----------------------------------------------------------------------
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout (clear cookies)' })
  @ApiNoContentResponse({ description: 'The user was logged out successfully.' })
  async logout(@Res({ passthrough: true }) response: Response) {
    this.authService.logout(response);
  }

  // -----------------------------------------------------------------------
  // POST /auth/refresh
  // -----------------------------------------------------------------------
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access + refresh tokens' })
  @ApiOkResponse({ description: 'New tokens returned and set as cookies.' })
  @ApiForbiddenResponse({ description: 'Unauthorized Request.' })
  async refresh(
    @Req() { user }: { user: User },
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.refreshTokens(user, response);
  }

  // -----------------------------------------------------------------------
  // GET /auth/me
  // -----------------------------------------------------------------------
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the currently authenticated user profile' })
  @ApiOkResponse({ description: 'Current user data.' })
  async getMe(@Req() { user }: { user: User }) {
    return this.authService.getCurrentUser(user.id);
  }

  // -----------------------------------------------------------------------
  // iMarket OTP endpoints (backward-compatible routes kept as aliases)
  // -----------------------------------------------------------------------

  // New clean route
  @Public()
  @Post('imarket/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for iMarket login' })
  @ApiOkResponse({ description: 'OTP sent to the phone number.' })
  async imarketLogin(@Body() dto: OtpRequestDto) {
    return this.authService.generateOtp(dto.phone);
  }

  // New clean route
  @Public()
  @Post('imarket/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm OTP for iMarket login/register' })
  @ApiOkResponse({ description: 'Access token returned.' })
  async imarketConfirm(@Body() dto: OtpConfirmDto) {
    return this.authService.validateIMarketUser(dto.phone, dto.code);
  }

  // -----------------------------------------------------------------------
  // Backward-compatible aliases (old routes used by existing mobile clients)
  // -----------------------------------------------------------------------

  /** @deprecated Use POST /auth/imarket/login */
  @Public()
  @Post('I-Market/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Legacy] Request OTP for iMarket login', deprecated: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { phone: { type: 'string' } },
    },
  })
  async legacyIMarketLogin(@Body() body: { phone: string }) {
    return this.authService.generateOtp(body.phone);
  }

  /** @deprecated Use POST /auth/imarket/confirm */
  @Public()
  @Post('I-Market/register/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[Legacy] Confirm OTP for iMarket', deprecated: true })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string' },
        code: { type: 'string' },
      },
    },
  })
  async legacyIMarketConfirm(@Body() body: { phone: string; code: string }) {
    return this.authService.validateIMarketUser(body.phone, body.code);
  }

  /** @deprecated Use GET /auth/me with Bearer token */
  @Public()
  @Get('get/I-Market/me')
  @ApiQuery({ type: String, name: 'token', required: false })
  @ApiOperation({ summary: '[Legacy] Get iMarket user profile by token', deprecated: true })
  async legacyGetMeIMarket(
    @Req() req: any,
    @Query() query: { token?: string },
  ) {
    const authHeader: string | undefined = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] || query.token;
    return this.authService.getMeIMarket(token);
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  @Public()
  @Get('clock')
  @ApiOperation({ summary: 'Server clock' })
  getClock() {
    return dayjs().format('DD MMMM YYYY HH:mm');
  }
}
