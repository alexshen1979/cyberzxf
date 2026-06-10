import { checkExpiredPoints } from './points.service';
import { createLogger } from '../utils/logger';
import { getWechatVirtualSettlementSyncSettings, syncWechatVirtualPaymentSettlements } from './payment.service';

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
  {
    name: 'virtual-payment-settlement-sync',
    intervalMs: 60 * 60 * 1000,
    handler: async () => {
      const settings = await getWechatVirtualSettlementSyncSettings();
      if (!settings.enabled) return;

      const lastRunKey = '__lastRun_virtual-payment-settlement-sync-dynamic';
      const holder = runJob as any;
      const lastRun = Number(holder[lastRunKey] || 0);
      const intervalMs = settings.intervalHours * 60 * 60 * 1000;
      if (Date.now() - lastRun < intervalMs) return;
      holder[lastRunKey] = Date.now();

      const result = await syncWechatVirtualPaymentSettlements({
        limit: settings.limit,
        days: settings.days,
        source: 'auto',
      });
      if (result.synced > 0 || result.failed > 0) {
        logger.info(
          '虚拟支付结算同步完成: interval=%dh days=%d limit=%d scanned=%d synced=%d settled=%d ios=%d android=%d failed=%d',
          settings.intervalHours,
          settings.days,
          settings.limit,
          result.scanned,
          result.synced,
          result.settled,
          result.ios,
          result.android,
          result.failed,
        );
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
  if (job.intervalMs > 60 * 60 * 1000) {
    const lastRunKey = `__lastRun_${job.name}`;
    const holder = runJob as any;
    const lastRun = Number(holder[lastRunKey] || 0);
    if (Date.now() - lastRun < job.intervalMs) return;
    holder[lastRunKey] = Date.now();
  }
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
