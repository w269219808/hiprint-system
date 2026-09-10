CREATE TABLE "barcode_counters" (
	"id" serial PRIMARY KEY NOT NULL,
	"date_prefix" varchar(8) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "barcode_counters_date_prefix_unique" UNIQUE("date_prefix")
);
