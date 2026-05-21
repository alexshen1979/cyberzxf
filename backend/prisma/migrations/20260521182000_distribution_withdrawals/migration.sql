-- Add withdrawal settings to distribution settings
ALTER TABLE "distribution_settings" ADD COLUMN "min_withdrawal_amount" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "distribution_settings" ADD COLUMN "withdrawal_freeze_days" INTEGER NOT NULL DEFAULT 7;

-- Create distribution withdrawal requests
CREATE TABLE "distribution_withdrawals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "withdrawal_no" TEXT NOT NULL,
  "distributor_id" TEXT NOT NULL,
  "user_id" TEXT,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "method" TEXT NOT NULL DEFAULT 'wechat_balance',
  "account_name" TEXT,
  "open_id" TEXT,
  "remark" TEXT,
  "admin_remark" TEXT,
  "transfer_no" TEXT,
  "requested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" DATETIME,
  "paid_at" DATETIME,
  "failed_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "distribution_withdrawals_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "distribution_withdrawals_withdrawal_no_key" ON "distribution_withdrawals"("withdrawal_no");
CREATE INDEX "distribution_withdrawals_distributor_id_created_at_idx" ON "distribution_withdrawals"("distributor_id", "created_at");
CREATE INDEX "distribution_withdrawals_status_created_at_idx" ON "distribution_withdrawals"("status", "created_at");
CREATE INDEX "distribution_withdrawals_user_id_idx" ON "distribution_withdrawals"("user_id");
