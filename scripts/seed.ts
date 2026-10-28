// Loads a roster JSON file (kept in gitignored local/) into the database.
// Usage: npm run seed -- local/roster.json
import { config } from "dotenv";
import { readFile } from "node:fs/promises";

config({ path: ".env.local" });

type Entry = { name: string; roles: ("laptop" | "assist" | "photog" | "poster")[]; posterOrder?: number; active?: boolean };

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Pass the roster file path, e.g. npm run seed -- local/roster.json");
  const { volunteers } = JSON.parse(await readFile(file, "utf8")) as { volunteers: Entry[] };
  // Imported after dotenv so DATABASE_URL is set when the pool is created.
  const { upsertVolunteer } = await import("../src/server/roster");
  for (const v of volunteers) {
    const r = await upsertVolunteer({ name: v.name, roles: v.roles, posterOrder: v.posterOrder ?? null, active: v.active });
    if (!r.ok) throw new Error(`${v.name}: ${r.error}`);
  }
  console.log(`Seeded ${volunteers.length} volunteers.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
