CREATE TYPE "public"."month_status" AS ENUM('open', 'locked', 'draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('laptop', 'assist', 'photog', 'poster');--> statement-breakpoint
CREATE TYPE "public"."slot_role" AS ENUM('laptop', 'assist', 'photog');--> statement-breakpoint
CREATE TYPE "public"."slot_source" AS ENUM('claimed', 'auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."swap_kind" AS ENUM('exchange', 'handover');--> statement-breakpoint
CREATE TYPE "public"."swap_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('teal', 'peach');--> statement-breakpoint
CREATE TABLE "months" (
	"id" serial PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"deadline" timestamp with time zone NOT NULL,
	"status" "month_status" DEFAULT 'open' NOT NULL,
	"poster_volunteer_id" integer,
	"theme" "theme" DEFAULT 'teal' NOT NULL,
	"autofill_seed" integer,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organiser_attempts" (
	"ip_hash" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_dates" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_id" integer NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_date_id" integer NOT NULL,
	"role" "slot_role" NOT NULL,
	"volunteer_id" integer,
	"source" "slot_source",
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "swap_kind" NOT NULL,
	"requester_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"requester_slot_id" integer NOT NULL,
	"target_slot_id" integer,
	"status" "swap_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "volunteer_roles" (
	"volunteer_id" integer NOT NULL,
	"role" "role" NOT NULL,
	CONSTRAINT "volunteer_roles_volunteer_id_role_pk" PRIMARY KEY("volunteer_id","role")
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"poster_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "volunteers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "months" ADD CONSTRAINT "months_poster_volunteer_id_volunteers_id_fk" FOREIGN KEY ("poster_volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_dates" ADD CONSTRAINT "service_dates_month_id_months_id_fk" FOREIGN KEY ("month_id") REFERENCES "public"."months"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_service_date_id_service_dates_id_fk" FOREIGN KEY ("service_date_id") REFERENCES "public"."service_dates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requester_id_volunteers_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."volunteers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_id_volunteers_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."volunteers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_requester_slot_id_slots_id_fk" FOREIGN KEY ("requester_slot_id") REFERENCES "public"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_requests" ADD CONSTRAINT "swap_requests_target_slot_id_slots_id_fk" FOREIGN KEY ("target_slot_id") REFERENCES "public"."slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "volunteer_roles" ADD CONSTRAINT "volunteer_roles_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "months_year_month" ON "months" USING btree ("year","month");--> statement-breakpoint
CREATE UNIQUE INDEX "service_dates_month_date" ON "service_dates" USING btree ("month_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "slots_date_role" ON "slots" USING btree ("service_date_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "slots_one_role_per_day" ON "slots" USING btree ("service_date_id","volunteer_id") WHERE "slots"."volunteer_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "swap_pending_requester_slot" ON "swap_requests" USING btree ("requester_slot_id") WHERE "swap_requests"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "swap_pending_target_slot" ON "swap_requests" USING btree ("target_slot_id") WHERE "swap_requests"."status" = 'pending';