import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/ids";
import { listVolunteers } from "@/server/roster";
import { getSwapDetail } from "@/server/swaps";
import { SwapResponder } from "./SwapResponder";

export default async function SwapPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const swap = await getSwapDetail(id);
  if (!swap) notFound();
  const volunteers = (await listVolunteers()).filter((v) => v.active);
  return <SwapResponder swap={swap} volunteers={volunteers} />;
}
