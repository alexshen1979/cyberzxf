ALTER TABLE "users" ADD COLUMN "register_ip" TEXT;

CREATE INDEX IF NOT EXISTS "users_register_ip_idx" ON "users"("register_ip");
