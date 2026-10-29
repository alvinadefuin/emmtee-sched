import type { Theme } from "@/lib/roles";

export type Palette = {
  background: string;
  title: string;
  titleShadow: string;
  wordmark: string;
  heading: string;
  tagText: string;
  bracket: string;
};

// Approximations of the existing Canva posters: teal/navy (Jun–Oct 2026) and peach/grey (Feb–May 2026).
export const PALETTES: Record<Theme, Palette> = {
  teal: {
    background: "linear-gradient(160deg, #57c3d0 0%, #9fb0b6 40%, #6b7a93 70%, #263661 100%)",
    title: "#111111",
    titleShadow: "rgba(0,0,0,0.25)",
    wordmark: "#124f50",
    heading: "#111111",
    tagText: "#14303f",
    bracket: "#ffffff",
  },
  peach: {
    background: "linear-gradient(160deg, #c48a5c 0%, #b4aea6 35%, #b5bcc0 60%, #f3eee4 100%)",
    title: "#f8f2e4",
    titleShadow: "rgba(60,50,40,0.45)",
    wordmark: "#c48a5c",
    heading: "#111111",
    tagText: "#4b4b4b",
    bracket: "#ffffff",
  },
};
