import { MediaBucket } from '../src/infra/shared/enum';

interface IJWT {
  accessTokenSecret: string;
  accessTokenExpiration: string;
  refreshTokenSecret: string;
  refreshTokenExpiration;
}

interface IDatabase {
  host: string;
  type: string;
  name: string;
  port: number;
  // url: string;
  username: string;
  password: string;
  database: string;
  entities: string[];
  synchronize: boolean;
  subscribers: Array<object>

  migrationsRun?: boolean;
  logging?: boolean;
  autoLoadEntities?: boolean;
  migrations?: string[];
  migrationsTableName: string;
  cli?: {
    migrationsDir?: string;
  };
  extra: {
    options: string,
  },
}

interface minIO {
  ENDPOINT: string,
  PORT: number,
  ACCESSKEY: string,
  SECRETKEY: string,
  BUCKET: MediaBucket;
  useSSL: string,
}

export interface IConfig {
  port: number;
  database: IDatabase;
  jwt: IJWT;
  newPasswordBytes: number;
  codeBytes: number;
  minIO: minIO,
}
