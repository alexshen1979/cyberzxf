ALTER TABLE "distribution_settings" ADD COLUMN "transfer_scene_id" TEXT NOT NULL DEFAULT '1005';
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_scene_name" TEXT NOT NULL DEFAULT '佣金报酬';
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_daily_limit" INTEGER NOT NULL DEFAULT 5000000;
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_single_min" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_single_max" INTEGER NOT NULL DEFAULT 20000;
ALTER TABLE "distribution_settings" ADD COLUMN "transfer_user_daily_limit" INTEGER NOT NULL DEFAULT 200000;
