import pino from 'pino';
import { config } from '../config';

export function createLogger(name: string) {
  return pino({
    name,
    level: config.server.isDev ? 'debug' : 'info',
    transport: config.server.isDev
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  });
}
