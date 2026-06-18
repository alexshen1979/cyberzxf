CREATE TABLE IF NOT EXISTS "tencent_ad_conversion_config" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "report_mode" TEXT NOT NULL DEFAULT 'click_id',
  "account_id" TEXT,
  "user_action_set_id" TEXT,
  "access_token" TEXT,
  "mini_app_id" TEXT,
  "conversion_id" TEXT,
  "api_url" TEXT NOT NULL DEFAULT 'https://api.e.qq.com/v3.0/user_actions/add',
  "attribution_window_days" INTEGER NOT NULL DEFAULT 30,
  "report_without_click_id" BOOLEAN NOT NULL DEFAULT false,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "tencent_ad_conversion_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL DEFAULT 'REGISTER',
  "outer_action_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "report_mode" TEXT NOT NULL DEFAULT 'click_id',
  "account_id" TEXT,
  "user_action_set_id" TEXT,
  "conversion_id" TEXT,
  "mini_app_id" TEXT,
  "wechat_openid" TEXT,
  "wechat_unionid" TEXT,
  "click_id" TEXT,
  "click_id_source" TEXT,
  "cb" TEXT,
  "callback_url" TEXT,
  "raw_attribution" TEXT,
  "request_payload" TEXT,
  "response_payload" TEXT,
  "last_error" TEXT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" DATETIME,
  "reported_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  CONSTRAINT "tencent_ad_conversion_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "tencent_ad_conversion_events_outer_action_id_key" ON "tencent_ad_conversion_events"("outer_action_id");
CREATE INDEX IF NOT EXISTS "tencent_ad_conversion_events_user_id_created_at_idx" ON "tencent_ad_conversion_events"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "tencent_ad_conversion_events_status_created_at_idx" ON "tencent_ad_conversion_events"("status", "created_at");
CREATE INDEX IF NOT EXISTS "tencent_ad_conversion_events_click_id_idx" ON "tencent_ad_conversion_events"("click_id");
