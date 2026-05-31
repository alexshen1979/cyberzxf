CREATE TABLE IF NOT EXISTS "recharge_analytics_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "event_type" TEXT NOT NULL,
  "user_id" TEXT,
  "session_id" TEXT,
  "product_id" TEXT,
  "order_id" TEXT,
  "amount" INTEGER,
  "channel" TEXT,
  "source" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recharge_analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "recharge_analytics_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "recharge_analytics_events_event_type_created_at_idx" ON "recharge_analytics_events"("event_type", "created_at");
CREATE INDEX IF NOT EXISTS "recharge_analytics_events_user_id_created_at_idx" ON "recharge_analytics_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "recharge_analytics_events_session_id_idx" ON "recharge_analytics_events"("session_id");
CREATE INDEX IF NOT EXISTS "recharge_analytics_events_order_id_idx" ON "recharge_analytics_events"("order_id");
