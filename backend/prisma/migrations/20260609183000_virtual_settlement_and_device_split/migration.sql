ALTER TABLE "users" ADD COLUMN "province" TEXT;
ALTER TABLE "users" ADD COLUMN "city" TEXT;

ALTER TABLE "orders" ADD COLUMN "payment_device" TEXT NOT NULL DEFAULT 'wechat_pay';
ALTER TABLE "orders" ADD COLUMN "virtual_order_type" INTEGER;
ALTER TABLE "orders" ADD COLUMN "virtual_sett_state" INTEGER;
ALTER TABLE "orders" ADD COLUMN "virtual_sett_time" DATETIME;
ALTER TABLE "orders" ADD COLUMN "virtual_platform_fee" INTEGER;
ALTER TABLE "orders" ADD COLUMN "virtual_cps_fee" INTEGER;
ALTER TABLE "orders" ADD COLUMN "virtual_net_amount" INTEGER;
ALTER TABLE "orders" ADD COLUMN "virtual_synced_at" DATETIME;

UPDATE "orders"
SET "payment_device" = CASE
  WHEN "pay_channel" = 'wechat_virtual' THEN 'android'
  WHEN "pay_channel" = 'wechat_pay' THEN 'wechat_pay'
  ELSE 'unknown'
END
WHERE "payment_device" IS NULL OR "payment_device" = 'wechat_pay';

CREATE INDEX IF NOT EXISTS "orders_payment_device_idx" ON "orders"("payment_device");
CREATE INDEX IF NOT EXISTS "orders_virtual_sett_state_idx" ON "orders"("virtual_sett_state");

CREATE TABLE "virtual_payment_balance_snapshots" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "available_amount_fen" INTEGER NOT NULL DEFAULT 0,
  "currency_code" TEXT NOT NULL DEFAULT 'CNY',
  "raw" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "virtual_payment_balance_snapshots_created_at_idx" ON "virtual_payment_balance_snapshots"("created_at");

ALTER TABLE "distribution_withdrawals" ADD COLUMN "ios_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "android_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "legacy_amount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "unknown_amount" INTEGER NOT NULL DEFAULT 0;
