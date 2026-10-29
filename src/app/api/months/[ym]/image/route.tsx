import { ImageResponse } from "next/og";
import { isOrganiser } from "@/app/session";
import { buildImageModel } from "@/image/model";
import { loadFonts } from "@/image/fonts";
import { ScheduleImage } from "@/image/ScheduleImage";
import { parseYm } from "@/lib/dates";
import { getMonthIdByYm, getMonthView } from "@/server/month-view";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ym: string }> }) {
  const parsed = parseYm((await ctx.params).ym);
  if (!parsed) return new Response("Bad month", { status: 400 });
  const id = await getMonthIdByYm(parsed.year, parsed.month);
  const view = id ? await getMonthView(id) : null;
  // Drafts are visible to the organiser only, so the look can be checked before publishing.
  if (!view || (view.status !== "published" && !(await isOrganiser()))) {
    return new Response("Not published", { status: 404 });
  }

  const model = buildImageModel({
    year: view.year,
    month: view.month,
    theme: view.theme,
    posterName: view.poster?.name ?? null,
    dates: view.dates.map((d) => ({
      date: d.date,
      laptop: d.slots.laptop.volunteerName,
      assist: d.slots.assist.volunteerName,
      photog: d.slots.photog.volunteerName,
    })),
  });

  try {
    return new ImageResponse(<ScheduleImage model={model} />, {
      width: 1500,
      height: 2000,
      fonts: await loadFonts(),
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return new Response("Failed to generate the image", { status: 500 });
  }
}
