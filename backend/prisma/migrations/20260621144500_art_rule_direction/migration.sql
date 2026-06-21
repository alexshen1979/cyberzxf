ALTER TABLE "art_admission_rules" ADD COLUMN "direction" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "art_admission_rules_province_year_art_category_batch_subject_type_key";
CREATE UNIQUE INDEX "art_admission_rules_province_year_art_category_batch_subject_type_direction_key"
ON "art_admission_rules" ("province", "year", "art_category", "batch", "subject_type", "direction");
