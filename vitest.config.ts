import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

// Integration tests read TEST_DATABASE_URL from here; unit tests never touch it.
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
