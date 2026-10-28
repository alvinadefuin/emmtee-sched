import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import ws from "ws";
import * as schema from "./schema";

// The WebSocket driver rather than neon-http: accepting a swap needs an interactive
// transaction with row locks, which the HTTP driver cannot do.
neonConfig.webSocketConstructor = ws;

// Serverless instances freeze between requests, so drop idle connections quickly
// rather than keep sockets the platform will cut anyway.
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, idleTimeoutMillis: 5_000 });
// An idle client losing its connection emits "error" on the pool; without a listener
// that would crash the process. The pool discards the client and the next query reconnects.
pool.on("error", (error: Error) => console.error("Database pool error:", error.message));

export const db = drizzle({ client: pool, schema });

/** Either `db` or a transaction handle, for helpers used both inside and outside transactions. */
export type Executor = PgDatabase<PgQueryResultHKT, typeof schema>;
