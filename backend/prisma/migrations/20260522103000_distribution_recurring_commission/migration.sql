ALTER TABLE "distribution_settings" ADD COLUMN "recurring_commission_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "distribution_settings" ADD COLUMN "recurring_level1_rate" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "distribution_settings" ADD COLUMN "recurring_level2_rate" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "distribution_settings" ADD COLUMN "recurring_commission_days" INTEGER NOT NULL DEFAULT 180;
