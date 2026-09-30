export interface GroupIn {
  name: string;
  hue: number;
  words: string[];
}

export interface Spot {
  word: string;
  hue: number;
  x: number;
  y: number;
  r: number;
}
export interface GBlob {
  name: string;
  hue: number;
  l: number;
  t: number;
  w: number;
  h: number;
}
export interface TableLayout {
  spots: Spot[];
  blobs: GBlob[];
  tableH: number;
}

// координатное пространство стола фиксировано — подложка/оверлей совпадают 1:1
export const W = 428;
// ponytail: масштаб под вьюпорт = ширина без паддингов #wrap, live-remeasure нет
export const SCALE = typeof window === "undefined" ? 1 : Math.min(1, (window.innerWidth - 32) / W);

export const hash = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
};
export const jit = (s: string, k: string, amp: number) => ((hash(s + k) % 1024) / 1024 - 0.5) * 2 * amp;

// детерминированный rng — раскладка одинаковая на каждой загрузке, рукописный оверлей не поедет
const mulberry = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = <T,>(a: T[], rnd: () => number) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};

export function layoutTable(groupsIn: GroupIn[]): TableLayout {
  const rnd = mulberry(20250607);
  const groups = groupsIn.map((g) => ({ name: g.name, hue: g.hue, words: shuffle(g.words, rnd) }));
  const spots: Spot[] = [];
  const blobs: GBlob[] = [];
  let y = 40;
  for (const g of groups) {
    const start = spots.length;
    const per = 5;
    const rows = Math.ceil(g.words.length / per);
    g.words.forEach((word, k) => {
      const row = Math.floor(k / per);
      const col = k % per;
      const inRow = Math.min(per, g.words.length - row * per);
      const rowW = (inRow - 1) * 78;
      spots.push({
        word,
        hue: g.hue,
        // крайние колонки не прижимаем к борту — подписи под призмами шире ячейки
        x: Math.max(56, Math.min(W - 56, W / 2 - rowW / 2 + col * 78 + jit(word, "x", 10))),
        y: y + row * 82 + jit(word, "y", 8),
        r: jit(word, "r", 9),
      });
    });
    // обводка группы: bounding box кучки с полями под подпись
    const gs = spots.slice(start);
    const xs = gs.map((s) => s.x), ys = gs.map((s) => s.y);
    const l = Math.max(4, Math.min(...xs) - 54);
    const r = Math.min(W - 4, Math.max(...xs) + 54);
    const t = Math.min(...ys) - 34;
    blobs.push({ name: g.name, hue: g.hue, l, t, w: r - l, h: Math.max(...ys) + 84 - t });
    y += rows * 82 + 44;
  }
  return { spots, blobs, tableH: y };
}
