ALTER TABLE "wechat_pay_config" ADD COLUMN "virtual_settlement_sync_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "wechat_pay_config" ADD COLUMN "virtual_settlement_sync_interval_hours" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "wechat_pay_config" ADD COLUMN "virtual_settlement_sync_days" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "wechat_pay_config" ADD COLUMN "virtual_settlement_sync_limit" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "wechat_pay_config" ADD COLUMN "virtual_settlement_last_synced_at" DATETIME;
ALTER TABLE "wechat_pay_config" ADD COLUMN "virtual_settlement_last_result" TEXT;
