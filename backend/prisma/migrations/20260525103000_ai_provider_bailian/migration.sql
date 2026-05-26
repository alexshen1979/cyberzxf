ALTER TABLE "ai_config" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'deepseek';
ALTER TABLE "ai_config" ADD COLUMN "bailian_model" TEXT DEFAULT 'qwen3.7-max';
ALTER TABLE "ai_config" ADD COLUMN "bailian_api_key" TEXT;
ALTER TABLE "ai_config" ADD COLUMN "bailian_base_url" TEXT;

UPDATE "ai_config"
SET "bailian_model" = 'qwen3.7-max'
WHERE "bailian_model" IS NULL OR TRIM("bailian_model") = '';

UPDATE "skills"
SET "model" = 'global'
WHERE "is_default" = true AND "model" = 'deepseek-chat';
