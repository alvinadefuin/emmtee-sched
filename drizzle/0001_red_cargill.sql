ALTER TABLE "swap_requests" ADD COLUMN "short_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "swap_requests_short_code" ON "swap_requests" USING btree ("short_code");