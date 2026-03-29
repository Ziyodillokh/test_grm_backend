import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { UserModule } from '@modules/user/user.module';
import { PositionModule } from '@modules/position/position.module';
import { RedisProvider } from '../../redis/redis.provider';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import {
  JwtAccessStrategy,
  JwtRefreshStrategy,
  LocalStrategy,
} from './strategies';

@Module({
  imports: [
    UserModule,
    PositionModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.getOrThrow('jwt');
        return {
          secret: jwtConfig.accessTokenSecret,
          signOptions: { expiresIn: jwtConfig.accessTokenExpiration },
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    LocalStrategy,
    RedisProvider,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
