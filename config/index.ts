import * as dotenv from 'dotenv';

import { IConfig } from './config.interface';
import subscribers from '../src/infra/subscribers';
import { MediaBucket } from '../src/infra/shared/enum';

dotenv.config();

export default (): IConfig => ({
  port: parseInt(process.env.PORT, 10) || 8000,

  database: {
    host: process.env.DB_HOST,
    type: process.env.DB_TYPE || 'postgres',
    name: 'default',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    logging: false,
    autoLoadEntities: true,
    entities: ['./dist/**/*.entity.js'],
    subscribers,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    migrations: [`${__dirname}/../db/migrations/*{.ts,.js}`],
    migrationsTableName: 'migration',
    extra: {
      options: '-c timezone=Asia/Tashkent',
    },
  },

  jwt: {
    accessTokenExpiration: process.env.JWT_ACCESS_TOKEN_EXPIRATION_TIME,
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenExpiration: process.env.JWT_REFRESH_TOKEN_EXPIRATION_TIME,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
  },

  minIO: {
    ENDPOINT: process.env.MINIO_ENDPOINT,
    PORT: +process.env.MINIO_PORT,
    ACCESSKEY: process.env.MINIO_ACCESSKEY,
    SECRETKEY: process.env.MINIO_SECRETKEY,
    BUCKET: MediaBucket.product,
    useSSL: process.env.MINIO_USE_SSL,
  },

  newPasswordBytes: 4,
  codeBytes: 2,
});
