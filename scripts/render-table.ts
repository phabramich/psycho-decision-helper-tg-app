// Рендер стола в SVG — подложка для рукописных пометок.
// Запуск: npx esbuild scripts/render-table.ts --bundle --platform=node --format=esm --outfile=/tmp/rt.mjs && node /tmp/rt.mjs
import { writeFileSync } from "node:fs";
import { NEED_GROUPS } from "../src/data.ts";
import { jit, layoutTable, W } from "../src/table.ts";

const { spots, tableH } = layoutTable(
  NEED_GROUPS.map((g) => ({ name: g.name, hue: g.hue, words: g.needs })),
);

const hues = [...new Set(spots.map((s) => s.hue))];
const defs = [
  ...hues.map(
    (h) =>
      `<linearGradient id="g${h}" x1="0" y1="0" x2="0.8" y2="1"><stop offset="0" stop-color="hsl(${h},70%,80%)"/><stop offset="1" stop-color="hsl(${h},55%,68%)"/></linearGradient>`,
  ),
  `<pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-55)"><line x1="3.5" y1="0" x2="3.5" y2="4" stroke="rgba(58,52,40,.13)" stroke-width="1"/></pattern>`,
  `<pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1.1" cy="1.1" r="1.1" fill="rgba(118,132,162,.42)"/></pattern>`,
  `<filter id="halo" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4"/></filter>`,
  `<filter id="grainf" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .4 0"/></filter>`,
].join("");

// та же скруглённая геометрия, что и clipPath #triclip (objectBoundingBox)
const D = "M.458.12Q.5.04.542.12L.928.85Q.97.93.88.93L.12.93Q.03.93.072.85Z";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const svg = (withWords: boolean) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${tableH}" viewBox="0 0 ${W} ${tableH}">
<defs>${defs}</defs>
<rect width="${W}" height="${tableH}" fill="#f4f4f3"/>
<rect width="${W}" height="${tableH}" fill="url(#dots)" opacity=".55"/>
${spots
  .map((s) => {
    const t = jit(s.word, "t", 16);
    const xf = `translate(${(s.x - 32).toFixed(1)} ${s.y.toFixed(1)}) scale(64 55)`;
    return `<g transform="rotate(${s.r.toFixed(1)} ${s.x.toFixed(1)} ${(s.y + 40).toFixed(1)})"><g transform="rotate(${t.toFixed(1)} ${s.x.toFixed(1)} ${(s.y + 27.5).toFixed(1)})"><path d="${D}" transform="${xf}" fill="none" stroke="hsl(${s.hue},55%,60%)" stroke-width="7" vector-effect="non-scaling-stroke" filter="url(#halo)" opacity=".85"/><path d="${D}" transform="${xf}" fill="none" stroke="hsl(${s.hue},48%,40%)" stroke-width="2.4" vector-effect="non-scaling-stroke" opacity=".9"/><path d="${D}" transform="${xf}" fill="url(#g${s.hue})"/><path d="${D}" transform="${xf}" fill="url(#hatch)"/></g>${
      withWords
        ? `<text x="${s.x.toFixed(1)}" y="${(s.y + 66).toFixed(1)}" text-anchor="middle" font-family="Caveat,cursive" font-size="15" fill="#3a3428">${esc(s.word)}</text>`
        : ""
    }</g>`;
  })
  .join("\n")}
<rect width="${W}" height="${tableH}" filter="url(#grainf)" opacity=".5"/>
</svg>`;

writeFileSync("public/proto/table-base.svg", svg(false));
writeFileSync("public/proto/table-words.svg", svg(true));
console.log(`wrote table-base.svg + table-words.svg (${W}x${tableH})`);
