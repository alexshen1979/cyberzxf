CREATE TABLE IF NOT EXISTS "distribution_settings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "level1_rate" INTEGER NOT NULL DEFAULT 5000,
  "level2_rate" INTEGER NOT NULL DEFAULT 2000,
  "updated_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "distributors" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 2,
  "parent_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "distributors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "distributors_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "distributors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "distribution_referrals" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "distributor_id" TEXT NOT NULL,
  "first_level_distributor_id" TEXT,
  "source_code" TEXT,
  "first_order_id" TEXT,
  "commission_settled_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribution_referrals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "distribution_referrals_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "distribution_referrals_first_level_distributor_id_fkey" FOREIGN KEY ("first_level_distributor_id") REFERENCES "distributors" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "distribution_commissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "distributor_id" TEXT NOT NULL,
  "referral_user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "rate_bps" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'settled',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "distribution_commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "distribution_commissions_distributor_id_fkey" FOREIGN KEY ("distributor_id") REFERENCES "distributors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "users" ADD COLUMN "referred_by_distributor_id" TEXT;
ALTER TABLE "users" ADD COLUMN "referred_at" DATETIME;
ALTER TABLE "orders" ADD COLUMN "commission_settled" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "distributors_user_id_key" ON "distributors"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "distributors_code_key" ON "distributors"("code");
CREATE INDEX IF NOT EXISTS "distributors_level_status_idx" ON "distributors"("level", "status");
CREATE INDEX IF NOT EXISTS "distributors_parent_id_idx" ON "distributors"("parent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "distribution_referrals_user_id_key" ON "distribution_referrals"("user_id");
CREATE INDEX IF NOT EXISTS "distribution_referrals_distributor_id_idx" ON "distribution_referrals"("distributor_id");
CREATE INDEX IF NOT EXISTS "distribution_referrals_first_level_distributor_id_idx" ON "distribution_referrals"("first_level_distributor_id");
CREATE INDEX IF NOT EXISTS "distribution_referrals_first_order_id_idx" ON "distribution_referrals"("first_order_id");
CREATE UNIQUE INDEX IF NOT EXISTS "distribution_commissions_order_id_distributor_id_role_key" ON "distribution_commissions"("order_id", "distributor_id", "role");
CREATE INDEX IF NOT EXISTS "distribution_commissions_distributor_id_created_at_idx" ON "distribution_commissions"("distributor_id", "created_at");
CREATE INDEX IF NOT EXISTS "distribution_commissions_referral_user_id_idx" ON "distribution_commissions"("referral_user_id");
CREATE INDEX IF NOT EXISTS "users_referred_by_distributor_id_idx" ON "users"("referred_by_distributor_id");
CREATE INDEX IF NOT EXISTS "orders_commission_settled_idx" ON "orders"("commission_settled");

INSERT OR IGNORE INTO "distribution_settings" (
  "id",
  "enabled",
  "level1_rate",
  "level2_rate",
  "updated_at"
) VALUES (
  'default',
  true,
  5000,
  2000,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "distributors" (
  "id",
  "user_id",
  "name",
  "code",
  "level",
  "parent_id",
  "status",
  "applied_at",
  "approved_at",
  "created_at",
  "updated_at"
) VALUES (
  'system-distributor',
  NULL,
  '系统',
  'SYSTEM',
  1,
  NULL,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
