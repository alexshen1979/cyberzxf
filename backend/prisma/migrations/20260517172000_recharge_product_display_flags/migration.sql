ALTER TABLE "recharge_products" ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "recharge_products" ADD COLUMN "badge_type" TEXT;

UPDATE "recharge_products"
SET "is_default" = true,
    "badge_type" = 'hot'
WHERE "id" = 'pkg_560';

UPDATE "recharge_products"
SET "badge_type" = 'best_value'
WHERE "id" = 'pkg_1000';
