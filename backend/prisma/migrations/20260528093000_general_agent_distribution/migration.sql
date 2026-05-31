ALTER TABLE "distributors" ADD COLUMN "general_agent_parent_id" TEXT;
ALTER TABLE "distributors" ADD COLUMN "general_agent_parent_assigned_at" DATETIME;
ALTER TABLE "distributors" ADD COLUMN "is_general_agent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "distributors" ADD COLUMN "general_agent_rate" INTEGER NOT NULL DEFAULT 2000;

CREATE TABLE IF NOT EXISTS "general_agent_commissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "order_id" TEXT NOT NULL,
  "general_agent_id" TEXT NOT NULL,
  "source_distributor_id" TEXT NOT NULL,
  "referral_user_id" TEXT NOT NULL,
  "rate_bps" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "settled_at" DATETIME,
  "admin_remark" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "general_agent_commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "general_agent_commissions_general_agent_id_fkey" FOREIGN KEY ("general_agent_id") REFERENCES "distributors" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "general_agent_commissions_source_distributor_id_fkey" FOREIGN KEY ("source_distributor_id") REFERENCES "distributors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "general_agent_commissions_order_id_general_agent_id_key" ON "general_agent_commissions"("order_id", "general_agent_id");
CREATE INDEX IF NOT EXISTS "general_agent_commissions_general_agent_id_created_at_idx" ON "general_agent_commissions"("general_agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "general_agent_commissions_source_distributor_id_created_at_idx" ON "general_agent_commissions"("source_distributor_id", "created_at");
CREATE INDEX IF NOT EXISTS "general_agent_commissions_referral_user_id_idx" ON "general_agent_commissions"("referral_user_id");
CREATE INDEX IF NOT EXISTS "general_agent_commissions_status_created_at_idx" ON "general_agent_commissions"("status", "created_at");
CREATE INDEX IF NOT EXISTS "distributors_general_agent_parent_id_idx" ON "distributors"("general_agent_parent_id");
CREATE INDEX IF NOT EXISTS "distributors_is_general_agent_status_idx" ON "distributors"("is_general_agent", "status");
