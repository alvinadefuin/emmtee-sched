import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

// DRIZZLE_TARGET=test points migrations at the throwaway test branch used by
// integration tests; otherwise DATABASE_URL (the dev branch locally).
const url =
  process.env.DRIZZLE_TARGET === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!url) {
  throw new Error("Database URL is not set in .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
