import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { swapPagePath } from "@/lib/swap-link";
import { findSwapIdByCode } from "@/server/swaps";

/**
 * Short swap link: /s/<CODE> sends the visitor (and link-preview crawlers) to the swap page
 * with a temporary (307) redirect, so /swap/<uuid> stays the one page for a request.
 */
export default async function ShortSwapLink({ params }: { params: Promise<{ code: string }> }) {
  await connection();
  const { code } = await params;
  const id = await findSwapIdByCode(code);
  if (!id) notFound();
  redirect(swapPagePath(id));
}
