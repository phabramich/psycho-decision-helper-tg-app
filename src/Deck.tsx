import { useMemo, useRef, useState } from "react";
import { GroupMarks, Minitri, needBg, sq, useZoom, Zoom } from "./components.tsx";
import { CUSTOM_HUE, NEED_GROUPS, needHue } from "./data.ts";
import { haptic } from "./tg.ts";
import { jit, layoutTable, SCALE, type Spot } from "./table.ts";
import type { Custom, Draft, Pick } from "./types.ts";

type PileId = 0 | 1 | "shared";
interface DragState {
  word: string;
  hue: number;
  x: number;
  y: number;
  gx: number; // точка захвата внутри пирамидки — клон не телепортируется из-под пальца
  gy: number;
  r: number; // наклон от скорости
  from: PileId | null; // откуда подняли: null = со стола, иначе кучка на листе
}

function Pile({
  picks,
  pile,
  dragWord,
  onDown,
  onMove,
  onUp,
  onCancel,
}: {
  picks: Pick[];
  pile: PileId;
  dragWord: string | null;
  onDown: (e: React.PointerEvent<HTMLDivElement>, word: string, pile: PileId) => void;
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onCancel: () => void;
}) {
  return (
    <div className="pile">
      {picks.map((p) => (
        <div
          key={p.need}
          className="pcell"
          style={{ opacity: dragWord === p.need ? 0.18 : 1 }}
          onPointerDown={(e) => onDown(e, p.need, pile)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
        >
          <Minitri need={p.need} />
          <div className="plabel">{p.need}</div>
        </div>
      ))}
    </div>
  );
}

export function Deck({
  draft,
  setDraft,
  custom,
  onDone,
  onBack,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  custom: Custom;
  onDone: () => void;
  onBack: () => void;
}) {
  const placed = new Set(
    [...draft.options[0].picks, ...draft.options[1].picks, ...draft.shared].map((p) => p.need),
  );

  // Раскладка стола: рыхлые ряды по цветовым группам, детерминированная — оверлей не поедет
  const groups = useMemo(
    () => [
      ...NEED_GROUPS.map((g) => ({ name: g.name, hue: g.hue, words: g.needs })),
      ...(custom.needs.length ? [{ name: "свои", hue: CUSTOM_HUE, words: custom.needs }] : []),
    ],
    [custom],
  );
  const { spots, tableH, blobs } = useMemo(() => layoutTable(groups), [groups]);
  const zp = useZoom();

  const [drag, setDrag] = useState<DragState | null>(null);
  const [gone, setGone] = useState<DragState | null>(null);
  const [hover, setHover] = useState<PileId | null>(null);
  const [thud, setThud] = useState(false);
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const cRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(true);

  const onScrollBoard = () => {
    const b = boardRef.current;
    if (b) setMoreBelow(b.scrollHeight - b.scrollTop - b.clientHeight > 40);
  };

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
    const pick: Pick = { need: word, feelings: [], values: [] };
    setDraft((d) =>
      pile === 0
        ? { ...d, options: [{ ...d.options[0], picks: [...d.options[0].picks, pick] }, d.options[1]] }
        : pile === 1
          ? { ...d, options: [d.options[0], { ...d.options[1], picks: [...d.options[1].picks, pick] }] }
          : { ...d, shared: [...d.shared, pick] },
    );
  };

  const uncommit = (word: string, pile: PileId) => {
    haptic();
    setDraft((d) => {
      const rm = (a: Pick[]) => a.filter((p) => p.need !== word);
      return pile === 0
        ? { ...d, options: [{ ...d.options[0], picks: rm(d.options[0].picks) }, d.options[1]] }
        : pile === 1
          ? { ...d, options: [d.options[0], { ...d.options[1], picks: rm(d.options[1].picks) }] }
          : { ...d, shared: rm(d.shared) };
    });
  };

  const grab = (e: React.PointerEvent<HTMLDivElement>, word: string, hue: number, from: PileId | null) => {
    if (drag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    haptic();
    const b = e.currentTarget.getBoundingClientRect();
    setDrag({
      word, hue, x: e.clientX, y: e.clientY,
      gx: e.clientX - (b.left + b.width / 2), gy: e.clientY - (b.top + b.height / 2), r: 0, from,
    });
    zp.down(word, needBg(hue), e.clientX, e.clientY, () => { setDrag(null); setHover(null); });
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>, s: Spot) => grab(e, s.word, s.hue, null);
  const onDownPile = (e: React.PointerEvent<HTMLDivElement>, word: string, pile: PileId) =>
    grab(e, word, needHue(word), pile);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    zp.move(e.clientX, e.clientY);
    if (!drag) return;
    const r = Math.max(-12, Math.min(12, (e.clientX - drag.x) * 1.4));
    setDrag({ ...drag, x: e.clientX, y: e.clientY, r });
    setHover(zoneAt(e.clientX, e.clientY));
  };
  const release = (d: DragState, z: PileId | null) => {
    setDrag(null);
    setHover(null);
    setGone(d);
    setTimeout(() => setGone(null), 200);
    if (z === null) {
      if (d.from !== null) uncommit(d.word, d.from); // утащили с листа — вернулась на стол
    } else if (z !== d.from) {
      setThud(true);
      setTimeout(() => setThud(false), 260);
      if (d.from !== null) uncommit(d.word, d.from);
      commit(d.word, z);
    }
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    zp.end();
    if (drag) release(drag, zoneAt(e.clientX, e.clientY));
  };
  const onCancel = () => {
    zp.end();
    if (drag) release(drag, null);
  };

  return (
    <div className="screen" style={{ height: "calc(100dvh - 16px - env(safe-area-inset-bottom))" }}>
      {/* шапка внутри скролла: уезжает вверх, лист остаётся прилипшим */}
      <div className="board" ref={boardRef} onScroll={onScrollBoard}>
        <div className="deck-top">
          <button className="back" onClick={onBack} aria-label="Назад">←</button>
          <div className="dilemma-line" style={sq(draft.dilemma)}>{draft.dilemma}</div>
          <button className="icon-btn go" style={sq("далее")} onClick={onDone} disabled={!canFinish}>
            далее →
          </button>
        </div>
        <div className="qline">какие потребности накормит каждый вариант?</div>

        <div className={`paper${thud ? " thud" : ""}`}>
          <div className={`phalf a${hover === 0 ? " hot" : ""}`} ref={aRef}>
            <div className="ptag">А · {draft.options[0].label}</div>
            <Pile picks={draft.options[0].picks} pile={0} dragWord={drag?.word ?? null}
              onDown={onDownPile} onMove={onMove} onUp={onUp} onCancel={onCancel} />
          </div>
          <div className={`fold${hover === "shared" ? " hot" : ""}`} ref={cRef}>
            <Pile picks={draft.shared} pile="shared" dragWord={drag?.word ?? null}
              onDown={onDownPile} onMove={onMove} onUp={onUp} onCancel={onCancel} />
          </div>
          <div className={`phalf b${hover === 1 ? " hot" : ""}`} ref={bRef}>
            <div className="ptag">Б · {draft.options[1].label}</div>
            <Pile picks={draft.options[1].picks} pile={1} dragWord={drag?.word ?? null}
              onDown={onDownPile} onMove={onMove} onUp={onUp} onCancel={onCancel} />
          </div>
        </div>

        <div className="thint">перетащи пирамидку на лист ↑</div>

        <div className="tscale" style={{ height: tableH * SCALE }}>
          <div className="table" style={{ height: tableH, transform: `scale(${SCALE})` }}>
          <GroupMarks blobs={blobs} />
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
                style={{ "--h": s.hue, transform: `rotate(${jit(s.word, "t", 16)}deg)` } as React.CSSProperties}
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
      </div>

      <div className={`scrolldn${moreBelow ? "" : " off"}`} aria-hidden="true">
        <svg width="26" height="30" viewBox="0 0 26 30" fill="none">
          <path d="M13 3c2 8-1 14 .5 21m0 0l-7-6m7 6l7-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {(drag || gone) && (
        <div
          className={`tclone${gone ? " gone" : ""}`}
          style={{
            left: (gone ?? drag)!.x - (gone ?? drag)!.gx,
            top: (gone ?? drag)!.y - (gone ?? drag)!.gy,
            transform: `translate(-50%, -50%) rotate(${(gone ?? drag)!.r - 4}deg)`,
          }}
        >
          <div className="ttri" style={{ "--h": (gone ?? drag)!.hue } as React.CSSProperties} />
          <div className="tlabel">{(gone ?? drag)!.word}</div>
        </div>
      )}

      {zp.zoom && <Zoom word={zp.zoom.word} bg={zp.zoom.bg} onClose={zp.close} />}
    </div>
  );
}
