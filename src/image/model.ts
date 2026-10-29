import { monthName } from "@/lib/dates";
import type { Theme } from "@/lib/roles";

export type ImageInput = {
  year: number;
  month: number;
  theme: Theme;
  posterName: string | null;
  dates: { date: string; laptop: string | null; assist: string | null; photog: string | null }[];
};

export type ImageRow = { day: string; operator: string; assist: string; photog: string };
export type ImageModel = { monthName: string; year: string; theme: Theme; poster: string; rows: ImageRow[] };

const tag = (name: string | null) => (name ? name.toUpperCase() : "---");

export function buildImageModel(input: ImageInput): ImageModel {
  return {
    monthName: monthName(input.month).toUpperCase(),
    year: String(input.year),
    theme: input.theme,
    poster: tag(input.posterName),
    rows: input.dates.map((d) => ({
      day: d.date.slice(8, 10),
      operator: tag(d.laptop),
      assist: tag(d.assist),
      photog: tag(d.photog),
    })),
  };
}
