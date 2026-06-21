CREATE TABLE "art_score_ranks" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "province" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "art_category" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "same_score_count" INTEGER,
  "cumulative_count" INTEGER NOT NULL,
  "batch" TEXT,
  "subject_type" TEXT NOT NULL DEFAULT '不限',
  "direction" TEXT NOT NULL DEFAULT '',
  "source_name" TEXT,
  "source_url" TEXT,
  "source_type" TEXT,
  "raw_data" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "art_score_ranks_province_year_art_category_subject_type_direction_score_key"
ON "art_score_ranks" ("province", "year", "art_category", "subject_type", "direction", "score");

CREATE INDEX "art_score_ranks_province_year_art_category_subject_type_idx"
ON "art_score_ranks" ("province", "year", "art_category", "subject_type");
