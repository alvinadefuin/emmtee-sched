import { connection } from "next/server";
import { isUuid } from "@/lib/ids";
import { getSwapVersion } from "@/server/version";

export const runtime = "nodejs";
// Polled by every open swap page to spot changes, so it must never be cached anywhere.
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/** `{ v }`: an opaque fingerprint of the swap request, its slots and its month's status. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await ctx.params;
  // Postgres rejects a malformed uuid with an error, so check before querying.
  const v = isUuid(id) ? await getSwapVersion(id) : null;
  if (!v) return Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  return Response.json({ v }, { headers: NO_STORE });
}
