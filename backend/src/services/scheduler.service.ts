import { checkExpiredPoints } from './points.service';
import { createLogger } from '../utils/logger';

const logger = createLogger('scheduler');

interface ScheduledJob {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
}

const jobs: ScheduledJob[] = [
  {
    name: 'expire-points',
    intervalMs: 60 * 60 * 1000, // 每小时检查一次
    handler: async () => {
      const count = await checkExpiredPoints();
      if (count > 0) {
        logger.info('过期点数清理完成: %d 个账户', count);
      }
    },
  },
];

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (timer) return;

  logger.info('定时任务调度器已启动 (%d 个任务)', jobs.length);

  // 立即执行一次
  for (const job of jobs) {
    runJob(job);
  }

  timer = setInterval(() => {
    for (const job of jobs) {
      runJob(job);
    }
  }, 60 * 60 * 1000); // 统一每小时 tick
}

function runJob(job: ScheduledJob): void {
  job.handler().catch((err) => {
    logger.error('定时任务 [%s] 执行失败: %s', job.name, err.message);
  });
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('定时任务调度器已停止');
  }
}
