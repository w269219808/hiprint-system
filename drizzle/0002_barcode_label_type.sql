ALTER TABLE "barcode_counters"
	ADD COLUMN IF NOT EXISTS "label_type" varchar(32);

UPDATE "barcode_counters"
SET "label_type" = 'trace'
WHERE "label_type" IS NULL;

ALTER TABLE "barcode_counters"
	ALTER COLUMN "label_type" SET DEFAULT 'trace',
	ALTER COLUMN "label_type" SET NOT NULL;

ALTER TABLE "barcode_counters"
	DROP CONSTRAINT IF EXISTS "barcode_counters_date_prefix_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "date_type_idx"
	ON "barcode_counters" ("date_prefix", "label_type");
