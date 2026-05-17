import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { createLogger } from './logger';

const logger = createLogger('prisma');

export const prisma = new PrismaClient({
  log: config.server.isDev
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
});

// Graceful shutdown
process.once('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma 连接已断开');
});
