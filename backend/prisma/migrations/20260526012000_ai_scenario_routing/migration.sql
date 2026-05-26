ALTER TABLE "ai_config" ADD COLUMN "normal_model" TEXT DEFAULT 'global';
ALTER TABLE "ai_config" ADD COLUMN "deep_model" TEXT DEFAULT 'global';
ALTER TABLE "ai_config" ADD COLUMN "normal_max_tokens" INTEGER DEFAULT 700;
ALTER TABLE "ai_config" ADD COLUMN "deep_max_tokens" INTEGER DEFAULT 2600;

UPDATE "ai_config"
SET "normal_model" = COALESCE(NULLIF(TRIM("bailian_model"), ''), NULLIF(TRIM("model"), ''), 'global')
WHERE "normal_model" IS NULL OR TRIM("normal_model") = '' OR "normal_model" = 'global';

UPDATE "ai_config"
SET "deep_model" = CASE
  WHEN "provider" = 'bailian' THEN 'qwen3.7-max'
  ELSE COALESCE(NULLIF(TRIM("model"), ''), 'global')
END
WHERE "deep_model" IS NULL OR TRIM("deep_model") = '' OR "deep_model" = 'global';
