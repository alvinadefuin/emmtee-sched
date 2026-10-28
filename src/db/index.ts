import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import ws from "ws";
import * as schema from "./schema";

// The WebSocket driver rather than neon-http: accepting a swap needs an interactive
// transaction with row locks, which the HTTP driver cannot do.
neonConfig.webSocketConstructor = ws;

export const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL! }), schema });

/** Either `db` or a transaction handle, for helpers used both inside and outside transactions. */
export type Executor = PgDatabase<PgQueryResultHKT, typeof schema>;
