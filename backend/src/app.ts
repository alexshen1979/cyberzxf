import Koa from 'koa';
import cors from '@koa/cors';
import helmet from 'koa-helmet';
import bodyParser from 'koa-bodyparser';
import { createLogger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { routes } from './routes';
import { config } from './config';
import { startScheduler } from './services/scheduler.service';

// Suppress MaxListeners warning from Prisma's exit handlers
process.setMaxListeners(20);

const app = new Koa();
const logger = createLogger('app');

// Trust proxy for rate limiting behind Nginx
app.proxy = true;

// Global middleware
app.use(helmet());
app.use(cors({ credentials: true }));
app.use(bodyParser({ enableTypes: ['json', 'form', 'text', 'xml'] }));
app.use(errorHandler);
app.use(rateLimiter);

// Routes
app.use(routes.routes());
app.use(routes.allowedMethods());

// Start server
const port = config.server.port;
app.listen(port, () => {
  logger.info(`🚀 赛博张老师后端服务已启动 → http://localhost:${port}`);
  logger.info(`环境: ${config.server.env}`);
  startScheduler();
});

export { app };
