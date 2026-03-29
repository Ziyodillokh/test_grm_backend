import { Provider, Logger } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

const logger = new Logger('RedisProvider');

export const RedisProvider: Provider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: async (): Promise<Redis> => {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      ...(process.env.REDIS_PASS && { password: process.env.REDIS_PASS }),
      ...(process.env.REDIS_DB && { db: Number(process.env.REDIS_DB) }),
      retryStrategy: (times: number): number | null => {
        if (times > 10) {
          logger.error('Redis max retry attempts reached. Giving up.');
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    };

    const client = new Redis(options);

    client.on('connect', () => {
      logger.log('Redis client connected');
    });

    client.on('ready', () => {
      logger.log('Redis client ready');
    });

    client.on('error', (err: Error) => {
      logger.error(`Redis client error: ${err.message}`);
    });

    client.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return client;
  },
};
