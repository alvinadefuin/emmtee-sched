const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** Graph-paper scrap with a torn diagonal edge, drawn in code so no licensed asset is needed. */
export function tornCornerDataUri(): string {
  const W = 700;
  const H = 520;
  const edge: string[] = [];
  const steps = 40;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const n = Math.sin(i * 12.9898) * 43758.5453; // deterministic jitter
    const off = (n - Math.floor(n) - 0.5) * 18;
    edge.push(`${(W * t + off).toFixed(1)},${(H * t - off).toFixed(1)}`);
  }
  const points = ["0,0", `${W},0`, ...edge].join(" ");
  const lines: string[] = [];
  for (let x = 0; x <= W; x += 24) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
  for (let y = 0; y <= H; y += 24) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<defs><clipPath id="c"><polygon points="${points}"/></clipPath></defs>` +
      `<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="#f5f5f3"/>` +
      `<g stroke="#2b2b2b" stroke-width="2">${lines.join("")}</g></g>` +
      `<polygon points="${points}" fill="none" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"/></svg>`,
  );
}

/** Dotted bracket joining every row to the single Poster tag. */
export function bracketDataUri(height: number, color: string): string {
  const w = 190;
  const mid = height / 2;
  const gap = 80;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}">` +
      `<path d="M0 3 H${w - 6} V${mid - gap} M${w - 6} ${mid + gap} V${height - 3} H0" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="6 8"/></svg>`,
  );
}
