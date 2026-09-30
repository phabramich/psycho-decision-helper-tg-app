import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { DESCR, needHue } from "./data.ts";
import { jit, W, type GBlob } from "./table.ts";

export function Minitri({ need }: { need: string }) {
  return (
    <div
      className="minitri"
      title={need}
      style={{ "--h": needHue(need), transform: `rotate(${jit(need, "m", 18)}deg)` } as CSSProperties}
    />
  );
}

export type Tone = "met" | "unmet" | "val" | "own";
export const TONE_BG: Record<Tone, string> = {
  met: "rgba(47,143,99,.32)",
  unmet: "rgba(194,73,111,.3)",
  val: "rgba(95,75,191,.32)",
  own: "rgba(58,52,40,.16)",
};
export const needBg = (h: number) => `hsl(${h} 62% 64% / .36)`;

/* росчерк-подчёркивание: одна из 4 линий, какой текст — такой и штрих */
export const sq = (s: string): CSSProperties =>
  ({ "--squig": `var(--sq${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) & 3})` }) as CSSProperties;

// дневниковые пометки групп: контур × тип подписи × позиция — каждая группа своя
const DECOR: {
  loop: "ell" | "rect" | "dash" | "none";
  tag: "tape" | "plain" | "mark" | "strip" | "circ" | "vert" | "uline";
  pos: "tl" | "tr" | "bl" | "br" | "side";
}[] = [
  { loop: "ell",  tag: "tape",  pos: "bl"   },
  { loop: "none", tag: "uline", pos: "tr"   },
  { loop: "none", tag: "plain", pos: "bl"   },
  { loop: "none", tag: "strip", pos: "tl"   },
  { loop: "dash", tag: "circ",  pos: "br"   },
  { loop: "none", tag: "vert",  pos: "side" },
  { loop: "ell",  tag: "mark",  pos: "tl"   },
  { loop: "rect", tag: "tape",  pos: "tr"   },
];

export function GroupMarks({ blobs }: { blobs: GBlob[] }) {
  return (
    <>
      {blobs.map((b, i) => {
        const d = DECOR[i % DECOR.length]!;
        const r = b.l + b.w, bo = b.t + b.h;
        const ps: CSSProperties =
          d.pos === "tl" ? { left: b.l + 14, top: b.t - 9 } :
          d.pos === "tr" ? { right: W - r + 14, top: b.t - 9 } :
          d.pos === "bl" ? { left: b.l + 14, top: bo - 8 } :
          d.pos === "br" ? { right: W - r + 14, top: bo - 8 } :
                           { right: W - r - 4, top: b.t + b.h / 2 - 48 };
        const up = d.pos === "bl" || d.pos === "br";
        return (
          <div key={b.name}>
            {d.loop !== "none" && (
              <div
                className={`gloop ${d.loop}`}
                style={{ left: b.l, top: b.t, width: b.w, height: b.h, "--h": b.hue, transform: `rotate(${jit(b.name, "lo", 1.6)}deg)` } as CSSProperties}
              />
            )}
            <div
              className={`gname ${d.tag}${up ? " up" : ""}`}
              style={{ ...ps, "--h": b.hue, transform: `rotate(${jit(b.name, "gt", 3)}deg)` } as CSSProperties}
            >
              <span style={sq(b.name)}>{b.name}</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

// удержание ~0.4с без движения → зум слова; движение/отпуск — обычный жест
export function useZoom() {
  const [zoom, setZoom] = useState<{ word: string; bg: string } | null>(null);
  const t = useRef<number | undefined>(undefined);
  const p0 = useRef<{ x: number; y: number } | null>(null);
  const down = (word: string, bg: string, x: number, y: number, onFire?: () => void) => {
    p0.current = { x, y };
    clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      onFire?.();
      setZoom({ word, bg });
    }, 430);
  };
  const move = (x: number, y: number) => {
    if (p0.current && Math.hypot(x - p0.current.x, y - p0.current.y) > 9) clearTimeout(t.current);
  };
  const end = () => {
    clearTimeout(t.current);
    p0.current = null;
    setZoom(null); // зум живёт, пока держат палец — отпустил → пропал
  };
  return { zoom, close: () => setZoom(null), down, move, end };
}

export function Zoom({ word, bg, onClose }: { word: string; bg: string; onClose: () => void }) {
  return (
    <div className="overlay zc" onClick={onClose}>
      <div className="zcard">
        <div className="tri-lens" style={{ background: bg }} />
        <div className="tri-word">{word}</div>
        <div className="zdesc">{DESCR[word] ?? "своё слово — смысл знаешь ты"}</div>
      </div>
    </div>
  );
}

export function Pill({
  label,
  tone = "plain",
  sel,
  onClick,
  dashed,
}: {
  label: string;
  tone?: "met" | "unmet" | "val" | "plain";
  sel?: boolean;
  onClick?: () => void;
  dashed?: boolean;
}) {
  return (
    <button className={`pill ${tone}${sel ? " sel" : ""}${dashed ? " add" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="sheet-x" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
