-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "union_id" TEXT,
    "mp_open_id" TEXT,
    "mini_open_id" TEXT,
    "nickname" TEXT,
    "avatar" TEXT,
    "phone" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "points_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "frozen" INTEGER NOT NULL DEFAULT 0,
    "expired_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "points_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "points_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "source" TEXT,
    "source_id" TEXT,
    "remark" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "points_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_no" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "bonus_points" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "consultation_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'miniprogram',
    "type" TEXT NOT NULL DEFAULT 'normal',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consultation_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cover" TEXT,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ai_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 2000,
    "top_p" REAL NOT NULL DEFAULT 0.9,
    "context_window" INTEGER NOT NULL DEFAULT 10,
    "skill_enabled" BOOLEAN NOT NULL DEFAULT true,
    "skill_weight" REAL NOT NULL DEFAULT 0.6,
    "points_per_query" INTEGER NOT NULL DEFAULT 5,
    "points_per_deep" INTEGER NOT NULL DEFAULT 18,
    "api_key" TEXT,
    "api_base_url" TEXT,
    "timeout" INTEGER NOT NULL DEFAULT 30000,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "temperature" REAL,
    "max_tokens" INTEGER,
    "top_p" REAL,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "system_notices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'notice',
    "status" TEXT NOT NULL DEFAULT 'published',
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "quick_questions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "question" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "auto_reply_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "match_mode" TEXT NOT NULL DEFAULT 'exact',
    "reply_type" TEXT NOT NULL DEFAULT 'text',
    "reply_content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'enabled',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "wechat_menus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT,
    "url" TEXT,
    "app_id" TEXT,
    "page_path" TEXT,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "status" INTEGER NOT NULL DEFAULT 1,
    "last_login" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_union_id_key" ON "users"("union_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_mp_open_id_key" ON "users"("mp_open_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_mini_open_id_key" ON "users"("mini_open_id");

-- CreateIndex
CREATE UNIQUE INDEX "points_accounts_user_id_key" ON "points_accounts"("user_id");

-- CreateIndex
CREATE INDEX "points_transactions_user_id_idx" ON "points_transactions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "consultation_records_user_id_session_id_idx" ON "consultation_records"("user_id", "session_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");
