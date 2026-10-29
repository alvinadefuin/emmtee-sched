import { connection } from "next/server";
import { parseYm } from "@/lib/dates";
import { getMonthVersion } from "@/server/version";

export const runtime = "nodejs";
// Polled by every open page to spot changes, so it must never be cached anywhere.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** `{ v }`: an opaque fingerprint of the month (or `latest`), which changes whenever a page showing it would. */
export async function GET(_req: Request, ctx: { params: Promise<{ ym: string }> }) {
  await connection();
  const raw = (await ctx.params).ym;
  const ym = raw === "latest" ? "latest" : parseYm(raw);
  const v = ym ? await getMonthVersion(ym) : null;
  if (!v) return Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  return Response.json({ v }, { headers: NO_STORE });
}
