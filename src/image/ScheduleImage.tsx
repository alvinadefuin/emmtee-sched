/* eslint-disable @next/next/no-img-element -- rendered by next/og, not the browser */
import type { ReactNode } from "react";
import type { ImageModel } from "./model";
import { PALETTES } from "./themes";
import { bracketDataUri, tornCornerDataUri } from "./svg";

const W = 1500;
const H = 2000;
const ROWS_TOP = 1010;
const ROW_H = 170;
// [left, width] of each column; tags are centred inside.
const COL = {
  date: [80, 190],
  operator: [270, 270],
  assist: [540, 220],
  photog: [760, 360],
  poster: [1150, 330],
} as const;

function Tag({ text, color, size }: { text: string; color: string; size: number }) {
  return (
    <div style={{ display: "flex", background: "#fbf1f6", borderRadius: 24, padding: "10px 28px", fontFamily: "Tag", fontWeight: 700, fontSize: size, color }}>
      {text}
    </div>
  );
}

function Cell({ col, top, children }: { col: readonly [number, number]; top: number; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: col[0], width: col[1], top, display: "flex", justifyContent: "center" }}>
      {children}
    </div>
  );
}

function Heading({ col, top, text, color, size = 64 }: { col: readonly [number, number]; top: number; text: string; color: string; size?: number }) {
  return (
    <Cell col={col} top={top}>
      <div style={{ display: "flex", fontFamily: "Title", fontSize: size, color, borderBottom: `3px solid ${color}`, paddingBottom: 2 }}>{text}</div>
    </Cell>
  );
}

export function ScheduleImage({ model }: { model: ImageModel }) {
  const p = PALETTES[model.theme];
  const titleSize = model.monthName.length >= 8 ? 180 : 220;
  const rowsHeight = Math.max(model.rows.length, 1) * ROW_H;
  const tilts = [-4, 3, -2, 4, -3, 2, -4, 3];

  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundImage: p.background }}>
      <img src={tornCornerDataUri()} width={700} height={520} alt="" style={{ position: "absolute", top: 0, right: 0 }} />

      <div style={{ position: "absolute", top: 110, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontFamily: "Title", fontSize: titleSize, color: p.title, letterSpacing: 4, lineHeight: 1, textShadow: `6px 6px 0 ${p.titleShadow}` }}>
          {model.monthName}
        </div>
        <div style={{ display: "flex", fontFamily: "Title", fontSize: 220, color: p.title, lineHeight: 1, marginTop: 10, textShadow: `6px 6px 0 ${p.titleShadow}` }}>
          {model.year}
        </div>
        <div style={{ display: "flex", marginTop: 30 }}>
          {"Schedule".split("").map((ch, i) => (
            <div key={i} style={{ display: "flex", fontFamily: "Wordmark", fontSize: 120, color: p.wordmark, background: "rgba(240,240,242,0.92)", padding: "0 10px", marginLeft: -4, transform: `rotate(${tilts[i]}deg)` }}>
              {ch}
            </div>
          ))}
        </div>
      </div>

      <Heading col={COL.date} top={840} text="DATE" color={p.heading} />
      <Heading col={[COL.operator[0], COL.operator[1] + COL.assist[1]]} top={840} text="LAPTOP" color={p.heading} />
      <Heading col={COL.photog} top={840} text="PHOTOG" color={p.heading} />
      <Heading col={COL.poster} top={840} text="POSTER" color={p.heading} />
      <Cell col={COL.operator} top={930}><div style={{ display: "flex", fontFamily: "Tag", fontWeight: 700, fontSize: 40, color: p.heading }}>OPERATOR</div></Cell>
      <Cell col={COL.assist} top={930}><div style={{ display: "flex", fontFamily: "Tag", fontWeight: 700, fontSize: 40, color: p.heading }}>ASSIST</div></Cell>

      {model.rows.map((row, i) => {
        const top = ROWS_TOP + i * ROW_H + 30;
        return [
          <Cell key={`d${i}`} col={COL.date} top={top}><Tag text={row.day} color={p.tagText} size={72} /></Cell>,
          <Cell key={`o${i}`} col={COL.operator} top={top}><Tag text={row.operator} color={p.tagText} size={72} /></Cell>,
          <Cell key={`a${i}`} col={COL.assist} top={top + 8}><Tag text={row.assist} color={p.tagText} size={58} /></Cell>,
          <Cell key={`p${i}`} col={COL.photog} top={top}><Tag text={row.photog} color={p.tagText} size={72} /></Cell>,
        ];
      })}

      <img src={bracketDataUri(rowsHeight - 80, p.bracket)} width={190} height={rowsHeight - 80} alt="" style={{ position: "absolute", left: 1125, top: ROWS_TOP + 40 }} />
      <Cell col={COL.poster} top={ROWS_TOP + rowsHeight / 2 - 50}><Tag text={model.poster} color={p.tagText} size={68} /></Cell>
    </div>
  );
}
