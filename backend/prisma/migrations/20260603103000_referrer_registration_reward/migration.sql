ALTER TABLE "distribution_settings" ADD COLUMN "referrer_registration_reward_amount" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "distributors" ADD COLUMN "registration_cash_reward_enabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "distribution_registration_rewards" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "share_referral_id" TEXT NOT NULL,
  "distributor_id" TEXT NOT NULL,
  "referral_user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'settled',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribution_registration_rewards_share_referral_id_fkey" FOREIGN KEY ("share_referral_id") REFERENCES "share_referrals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "distribution_registration_rewards_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "distribution_registration_rewards_share_referral_id_key" ON "distribution_registration_rewards"("share_referral_id");
CREATE INDEX IF NOT EXISTS "distribution_registration_rewards_distributor_id_created_at_idx" ON "distribution_registration_rewards"("distributor_id", "created_at");
CREATE INDEX IF NOT EXISTS "distribution_registration_rewards_referral_user_id_idx" ON "distribution_registration_rewards"("referral_user_id");
