import { readFile } from "node:fs/promises";
import path from "node:path";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

const dir = path.join(process.cwd(), "assets", "fonts");
let cached: Promise<Font[]> | null = null;

async function load(file: string, name: string, weight: 400 | 700): Promise<Font> {
  const buf = await readFile(path.join(dir, file));
  return { name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" };
}

export function loadFonts(): Promise<Font[]> {
  cached ??= Promise.all([
    load("CinzelDecorative-Regular.ttf", "Title", 400),
    load("AbrilFatface-Regular.ttf", "Wordmark", 400),
    load("AmaticSC-Bold.ttf", "Tag", 700),
  ]);
  return cached;
}
