CREATE TABLE "print_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"print_type" varchar(50) NOT NULL,
	"content_summary" text,
	"ip_address" varchar(50),
	"status" varchar(20) DEFAULT 'SUCCESS',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "printer_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"paper_size" varchar(20) NOT NULL,
	"printer_name" varchar(100) NOT NULL,
	"client_id" varchar(50),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "printer_configs_paper_size_unique" UNIQUE("paper_size")
);
