ALTER TABLE "distribution_settings" ADD COLUMN "daily_share_reward" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "distribution_settings" ADD COLUMN "referral_reward" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "distributors" ADD COLUMN "new_user_gift_override" INTEGER;
