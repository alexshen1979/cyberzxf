ALTER TABLE "users" ADD COLUMN "share_code" TEXT;

CREATE TABLE IF NOT EXISTS "share_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "share_code" TEXT,
  "channel" TEXT NOT NULL,
  "path" TEXT,
  "rewarded" BOOLEAN NOT NULL DEFAULT false,
  "reward_points" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "share_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "daily_share_rewards" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "reward_date" TEXT NOT NULL,
  "points" INTEGER NOT NULL DEFAULT 10,
  "transaction_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_share_rewards_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "share_referrals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "referrer_user_id" TEXT NOT NULL,
  "source_code" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "share_referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "share_referrals_referrer_user_id_fkey" FOREIGN KEY ("referrer_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_share_code_key" ON "users"("share_code");
CREATE INDEX IF NOT EXISTS "share_events_user_id_created_at_idx" ON "share_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "share_events_share_code_idx" ON "share_events"("share_code");
CREATE UNIQUE INDEX IF NOT EXISTS "daily_share_rewards_user_id_reward_date_key" ON "daily_share_rewards"("user_id", "reward_date");
CREATE INDEX IF NOT EXISTS "daily_share_rewards_reward_date_idx" ON "daily_share_rewards"("reward_date");
CREATE UNIQUE INDEX IF NOT EXISTS "share_referrals_user_id_key" ON "share_referrals"("user_id");
CREATE INDEX IF NOT EXISTS "share_referrals_referrer_user_id_idx" ON "share_referrals"("referrer_user_id");
CREATE INDEX IF NOT EXISTS "share_referrals_source_code_idx" ON "share_referrals"("source_code");
