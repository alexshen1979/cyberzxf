CREATE TABLE "art_admission_rules" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "province" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "art_category" TEXT NOT NULL,
  "batch" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL DEFAULT '不限',
  "formula_type" TEXT NOT NULL DEFAULT 'weighted',
  "culture_full_score" INTEGER NOT NULL DEFAULT 750,
  "professional_full_score" INTEGER NOT NULL DEFAULT 300,
  "culture_weight" REAL NOT NULL,
  "professional_weight" REAL NOT NULL,
  "scale_to" INTEGER NOT NULL DEFAULT 750,
  "min_culture_score" REAL,
  "min_professional_score" REAL,
  "source_name" TEXT,
  "source_url" TEXT,
  "source_type" TEXT,
  "notes" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "art_admission_rules_province_year_art_category_batch_subject_type_key"
ON "art_admission_rules"("province", "year", "art_category", "batch", "subject_type");

CREATE INDEX "art_admission_rules_province_year_art_category_idx"
ON "art_admission_rules"("province", "year", "art_category");

CREATE TABLE "art_admission_scores" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "university_id" TEXT,
  "university_name" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "batch" TEXT NOT NULL,
  "art_category" TEXT NOT NULL,
  "subject_type" TEXT NOT NULL DEFAULT '不限',
  "major_name" TEXT,
  "group_code" TEXT,
  "group_name" TEXT,
  "min_composite_score" REAL,
  "min_culture_score" REAL,
  "min_professional_score" REAL,
  "min_rank" INTEGER,
  "plan_count" INTEGER,
  "admission_method" TEXT,
  "source_name" TEXT,
  "source_url" TEXT,
  "source_type" TEXT,
  "data_quality" TEXT NOT NULL DEFAULT 'unknown',
  "raw_data" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "art_admission_scores_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "universities" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "art_admission_scores_province_year_art_category_idx"
ON "art_admission_scores"("province", "year", "art_category");

CREATE INDEX "art_admission_scores_university_name_idx"
ON "art_admission_scores"("university_name");

CREATE INDEX "art_admission_scores_university_id_idx"
ON "art_admission_scores"("university_id");

CREATE INDEX "art_admission_scores_source_type_idx"
ON "art_admission_scores"("source_type");
