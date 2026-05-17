CREATE TABLE IF NOT EXISTS "point_settings" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  "free_gift" INTEGER NOT NULL DEFAULT 100,
  "default_cost" INTEGER NOT NULL DEFAULT 5,
  "deep_analysis_cost" INTEGER NOT NULL DEFAULT 18,
  "volunteer_analysis_cost" INTEGER NOT NULL DEFAULT 18,
  "expire_days" INTEGER NOT NULL DEFAULT 365,
  "updated_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "recharge_products" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" INTEGER NOT NULL,
  "points" INTEGER NOT NULL,
  "bonus" INTEGER NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "recharge_products_enabled_sort_order_idx" ON "recharge_products"("enabled", "sort_order");

INSERT OR IGNORE INTO "point_settings" (
  "id",
  "free_gift",
  "default_cost",
  "deep_analysis_cost",
  "volunteer_analysis_cost",
  "expire_days",
  "updated_at"
) VALUES (
  'default',
  100,
  5,
  18,
  18,
  365,
  CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "recharge_products" (
  "id",
  "name",
  "description",
  "price",
  "points",
  "bonus",
  "sort_order",
  "enabled",
  "updated_at"
) VALUES
  ('pkg_50', '50 咨询点数', '适合短期体验和少量咨询', 990, 50, 0, 10, true, CURRENT_TIMESTAMP),
  ('pkg_120', '110 咨询点数 + 赠10点', '适合多次问答，赠送 10 点', 1990, 110, 10, 20, true, CURRENT_TIMESTAMP),
  ('pkg_200', '180 咨询点数 + 赠20点', '适合高考志愿季集中使用', 2990, 180, 20, 30, true, CURRENT_TIMESTAMP),
  ('pkg_360', '320 咨询点数 + 赠40点', '适合家庭长期规划使用', 4990, 320, 40, 40, true, CURRENT_TIMESTAMP);
