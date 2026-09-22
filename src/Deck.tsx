import { useMemo, useRef, useState } from "react";
import { CUSTOM_HUE, NEED_GROUPS, needBg } from "./data.ts";
import { haptic } from "./tg.ts";
import type { Custom, Draft, Pick } from "./types.ts";

type PileId = 0 | 1 | "shared";
interface Spot {
  word: string;
  hue: number;
  x: number;
  y: number;
  r: number;
}
interface DragState {
  word: string;
  hue: number;
  x: number;
  y: number;
}

const W = 428;
const hash = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
};
const jit = (s: string, k: string, amp: number) => ((hash(s + k) % 1024) / 1024 - 0.5) * 2 * amp;
const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};
const grad = (h: number) => `linear-gradient(160deg, hsl(${h} 80% 72%), hsl(${h} 68% 58%))`;

function Minitri({ need }: { need: string }) {
  return (
    <div
      className="minitri"
      title={need}
      style={{ background: needBg(need), transform: `rotate(${jit(need, "m", 18)}deg)` }}
    />
  );
}

export function Deck({
  draft,
  setDraft,
  custom,
  onDone,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  custom: Custom;
  onDone: () => void;
}) {
  const placed = new Set(
    [...draft.options[0].picks, ...draft.options[1].picks, ...draft.shared].map((p) => p.need),
  );

  // Раскладка стола: рыхлые ряды по цветовым группам, позиции стабильны на всю сессию
  const { spots, tableH } = useMemo(() => {
    const groups = [
      ...NEED_GROUPS.map((g) => ({ hue: g.hue, needs: shuffle(g.needs) })),
      ...(custom.needs.length ? [{ hue: CUSTOM_HUE, needs: shuffle(custom.needs) }] : []),
    ];
    const spots: Spot[] = [];
    let y = 26;
    for (const g of groups) {
      const per = 5;
      const rows = Math.ceil(g.needs.length / per);
      g.needs.forEach((word, k) => {
        const row = Math.floor(k / per);
        const col = k % per;
        const inRow = Math.min(per, g.needs.length - row * per);
        const rowW = (inRow - 1) * 78;
        spots.push({
          word,
          hue: g.hue,
          x: W / 2 - rowW / 2 + col * 78 + jit(word, "x", 10),
          y: y + row * 82 + jit(word, "y", 8),
          r: jit(word, "r", 9),
        });
      });
      y += rows * 82 + 30;
    }
    return { spots, tableH: y };
  }, [custom]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [gone, setGone] = useState<DragState | null>(null);
  const [hover, setHover] = useState<PileId | null>(null);
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const cRef = useRef<HTMLDivElement>(null);
  const hist = useRef<{ word: string; pile: PileId }[]>([]);

  const nA = draft.options[0].picks.length;
  const nB = draft.options[1].picks.length;
  const canFinish = nA + nB + draft.shared.length > 0;

  const zoneAt = (x: number, y: number): PileId | null => {
    const hit = (r: React.RefObject<HTMLDivElement | null>) => {
      const b = r.current?.getBoundingClientRect();
      return b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
    };
    if (hit(cRef)) return "shared";
    if (hit(aRef)) return 0;
    if (hit(bRef)) return 1;
    return null;
  };

  const commit = (word: string, pile: PileId) => {
    haptic();
    hist.current.push({ word, pile });
    const pick: Pick = { need: word, feelings: [], values: [] };
    setDraft((d) =>
      pile === 0
        ? { ...d, options: [{ ...d.options[0], picks: [...d.options[0].picks, pick] }, d.options[1]] }
        : pile === 1
          ? { ...d, options: [d.options[0], { ...d.options[1], picks: [...d.options[1].picks, pick] }] }
          : { ...d, shared: [...d.shared, pick] },
    );
  };

  const undo = () => {
    const last = hist.current.pop();
    if (!last) return;
    haptic();
    setDraft((d) => {
      const arr = last.pile === "shared" ? d.shared : d.options[last.pile].picks;
      let idx = -1;
      for (let k = arr.length - 1; k >= 0; k--) {
        if (arr[k]!.need === last.word) { idx = k; break; }
      }
      if (idx < 0) return d;
      const next = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
      if (last.pile === 0) return { ...d, options: [{ ...d.options[0], picks: next }, d.options[1]] };
      if (last.pile === 1) return { ...d, options: [d.options[0], { ...d.options[1], picks: next }] };
      return { ...d, shared: next };
    });
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>, s: Spot) => {
    if (drag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ word: s.word, hue: s.hue, x: e.clientX, y: e.clientY - 60 });
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ ...drag, x: e.clientX, y: e.clientY - 60 });
    setHover(zoneAt(e.clientX, e.clientY));
  };
  const release = (d: DragState, z: PileId | null) => {
    setDrag(null);
    setHover(null);
    setGone(d);
    setTimeout(() => setGone(null), 200);
    if (z !== null) commit(d.word, z);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag) release(drag, zoneAt(e.clientX, e.clientY));
  };
  const onCancel = () => {
    if (drag) release(drag, null);
  };

  return (
    <div className="screen" style={{ height: "calc(100dvh - 130px)" }}>
      <div className="dilemma-line">{draft.dilemma}</div>
      <div className="deck-top">
        <div className="counts">
          <span className="cb">←Б {nB}</span>
          <span className="cs">обоим {draft.shared.length}</span>
          <span className="ca">А→ {nA}</span>
        </div>
        <button className="icon-btn" onClick={undo} disabled={!hist.current.length} title="Вернуть карту">
          ↩
        </button>
        <button className="icon-btn" onClick={onDone} disabled={!canFinish}>
          линзы →
        </button>
      </div>

      <div className="board">
        <div className="paper">
          <div className={`phalf a${hover === 0 ? " hot" : ""}`} ref={aRef}>
            <div className="ptag">А · {draft.options[0].label}</div>
            <div className="pile">
              {draft.options[0].picks.map((p) => <Minitri key={p.need} need={p.need} />)}
            </div>
          </div>
          <div className={`fold${hover === "shared" ? " hot" : ""}`} ref={cRef}>
            <div className="pile">
              {draft.shared.map((p) => <Minitri key={p.need} need={p.need} />)}
            </div>
          </div>
          <div className={`phalf b${hover === 1 ? " hot" : ""}`} ref={bRef}>
            <div className="ptag">Б · {draft.options[1].label}</div>
            <div className="pile">
              {draft.options[1].picks.map((p) => <Minitri key={p.need} need={p.need} />)}
            </div>
          </div>
        </div>

        <div className="thint dim">тащи пирамидку на лист · сгиб посередине = обоим</div>

        <div className="table" style={{ height: tableH }}>
          {spots.filter((s) => !placed.has(s.word)).map((s) => (
            <div
              key={s.word}
              className="tcell"
              style={{
                left: s.x,
                top: s.y,
                transform: `rotate(${s.r}deg)`,
                opacity: drag?.word === s.word ? 0.18 : 1,
              }}
            >
              <div
                className="ttri"
                style={{ background: grad(s.hue), transform: `rotate(${jit(s.word, "t", 16)}deg)` }}
                onPointerDown={(e) => onDown(e, s)}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onCancel}
              />
              <div className="tlabel">{s.word}</div>
            </div>
          ))}
          {spots.every((s) => placed.has(s.word)) && (
            <div className="empty">стол пуст — всё разложено</div>
          )}
        </div>
      </div>

      {(drag || gone) && (
        <div
          className={`tclone${gone ? " gone" : ""}`}
          style={{
            left: (gone ?? drag)!.x,
            top: (gone ?? drag)!.y,
          }}
        >
          <div className="ttri" style={{ background: grad((gone ?? drag)!.hue) }} />
          <div className="tlabel">{(gone ?? drag)!.word}</div>
        </div>
      )}
    </div>
  );
}
