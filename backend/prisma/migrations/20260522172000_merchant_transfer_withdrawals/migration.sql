ALTER TABLE "distribution_settings" ADD COLUMN "transfer_notify_url" TEXT;
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_user_confirm" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_report_job_type" TEXT NOT NULL DEFAULT '推广服务';
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_report_reward_desc" TEXT NOT NULL DEFAULT '涨识推荐合作佣金报酬';

ALTER TABLE "distribution_withdrawals" ADD COLUMN "out_bill_no" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "wechat_transfer_bill_no" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_state" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_package_info" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_scene_id" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_fail_reason" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_remark" TEXT;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_requested_at" DATETIME;
ALTER TABLE "distribution_withdrawals" ADD COLUMN "transfer_confirmed_at" DATETIME;

CREATE UNIQUE INDEX "distribution_withdrawals_out_bill_no_key" ON "distribution_withdrawals"("out_bill_no");
CREATE INDEX "distribution_withdrawals_out_bill_no_idx" ON "distribution_withdrawals"("out_bill_no");
CREATE INDEX "distribution_withdrawals_wechat_transfer_bill_no_idx" ON "distribution_withdrawals"("wechat_transfer_bill_no");

ALTER TABLE "wechat_pay_config" ADD COLUMN "transfer_notify_url" TEXT;
