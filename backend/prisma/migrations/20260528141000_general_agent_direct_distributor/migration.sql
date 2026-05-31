ALTER TABLE "general_agent_commissions" ADD COLUMN "direct_distributor_id" TEXT;
CREATE INDEX IF NOT EXISTS "general_agent_commissions_direct_distributor_id_idx" ON "general_agent_commissions"("direct_distributor_id");
