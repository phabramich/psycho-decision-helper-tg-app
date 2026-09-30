import { useMemo, useRef, useState } from "react";
import { GroupMarks, Minitri, sq, TONE_BG, needBg, useZoom, Zoom, type Tone } from "./components.tsx";
import { CUSTOM_HUE, FEELINGS_MET, FEELINGS_UNMET, needHue, VALUES } from "./data.ts";
import { haptic } from "./tg.ts";
import { jit, layoutTable, SCALE } from "./table.ts";
import type { Custom, Draft, Pick } from "./types.ts";

type Phase = "feelings" | "values";
interface DragState {
  word: string;
  tone: Tone;
  x: number;
  y: number;
  gx: number; // точка захвата внутри призмы — клон не телепортируется из-под пальца
  gy: number;
  r: number; // наклон от скорости
}

const QUESTION: Record<Phase, string> = {
  feelings: "что ты почувствуешь, когда потребность накормлена?",
  values: "за какой ценностью стоит каждая потребность?",
};

export function Lenses({
  draft,
  setDraft,
  custom,
  phase,
  onDone,
  onBack,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  custom: Custom;
  phase: Phase;
  onDone: () => void;
  onBack: () => void;
}) {
  const isF = phase === "feelings";

  // чувства делятся на приятные/тяжёлые, свои слова — отдельной кучкой; ценности — одной
  const groups = useMemo(
    () =>
      isF
        ? [
            { name: "приятные", hue: 152, words: FEELINGS_MET },
            { name: "тяжёлые", hue: 338, words: FEELINGS_UNMET },
            ...(custom.feelings.length ? [{ name: "свои", hue: CUSTOM_HUE, words: custom.feelings }] : []),
          ]
        : [
            { name: "ценности", hue: 250, words: VALUES },
            ...(custom.values.length ? [{ name: "свои", hue: CUSTOM_HUE, words: custom.values }] : []),
          ],
    [isF, custom],
  );
  const { spots, tableH, blobs } = useMemo(() => layoutTable(groups), [groups]);

  const toneOf = (w: string): Tone =>
    isF
      ? FEELINGS_MET.includes(w) ? "met" : FEELINGS_UNMET.includes(w) ? "unmet" : "own"
      : VALUES.includes(w) ? "val" : "own";

  const [drag, setDrag] = useState<DragState | null>(null);
  const [gone, setGone] = useState<DragState | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [thud, setThud] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(true);
  const zp = useZoom();

  const picks = [...draft.options[0].picks, ...draft.options[1].picks, ...draft.shared];

  const onScrollBoard = () => {
    const b = boardRef.current;
    if (b) setMoreBelow(b.scrollHeight - b.scrollTop - b.clientHeight > 40);
  };

  const edit = (need: string, fn: (p: Pick) => Pick) =>
    setDraft((d) => {
      const map = (arr: Pick[]) => arr.map((p) => (p.need === need ? fn(p) : p));
      return {
        ...d,
        options: [ { ...d.options[0], picks: map(d.options[0].picks) }, { ...d.options[1], picks: map(d.options[1].picks) } ],
        shared: map(d.shared),
      };
    });
  const attach = (need: string, w: string) =>
    edit(need, (p) => (p[phase].includes(w) ? p : { ...p, [phase]: [...p[phase], w] }));
  const detach = (need: string, w: string) => {
    haptic();
    edit(need, (p) => ({ ...p, [phase]: p[phase].filter((x) => x !== w) }));
  };

  // под пальцем — ячейка потребности на листе (клон pointer-events:none, не мешает)
  const needAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-need]");
    return el ? (el as HTMLElement).dataset.need! : null;
  };

  const grab = (e: React.PointerEvent<HTMLDivElement>, word: string, tone: Tone) => {
    if (drag) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    haptic();
    const b = e.currentTarget.getBoundingClientRect();
    setDrag({
      word, tone, x: e.clientX, y: e.clientY,
      gx: e.clientX - (b.left + b.width / 2), gy: e.clientY - (b.top + b.height / 2), r: 0,
    });
    zp.down(word, TONE_BG[tone], e.clientX, e.clientY, () => { setDrag(null); setHot(null); });
  };
  // потребность на листе не таскается — только удержание → зум
  const onDownNeed = (e: React.PointerEvent<HTMLDivElement>, need: string) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    zp.down(need, needBg(needHue(need)), e.clientX, e.clientY);
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    zp.move(e.clientX, e.clientY);
    if (!drag) return;
    const r = Math.max(-12, Math.min(12, (e.clientX - drag.x) * 1.4));
    setDrag({ ...drag, x: e.clientX, y: e.clientY, r });
    setHot(needAt(e.clientX, e.clientY));
  };
  const release = (d: DragState, x: number, y: number) => {
    setDrag(null);
    setHot(null);
    setGone(d);
    setTimeout(() => setGone(null), 200);
    const need = needAt(x, y);
    if (need) {
      setThud(true);
      setTimeout(() => setThud(false), 260);
      haptic();
      attach(need, d.word);
    }
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    zp.end();
    if (drag) release(drag, e.clientX, e.clientY);
  };
  const onCancel = () => {
    zp.end();
    if (drag) { setDrag(null); setHot(null); }
  };

  const cell = (p: Pick) => (
    <div
      key={p.need}
      data-need={p.need}
      className={`pcell lcell${hot === p.need ? " hot" : ""}`}
      onPointerDown={(e) => onDownNeed(e, p.need)}
      onPointerMove={(e) => zp.move(e.clientX, e.clientY)}
      onPointerUp={zp.end}
      onPointerCancel={zp.end}
    >
      <Minitri need={p.need} />
      <div className="plabel">{p.need}</div>
      <div className="lchips">
        {p[phase].map((w) => (
          <span
            key={w}
            className={`lnote ${toneOf(w)}`}
            style={{ transform: `rotate(${jit(w, "n", 4)}deg)` }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); detach(p.need, w); }}
          >
            {w}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="screen" style={{ height: "calc(100dvh - 16px - var(--sait) - env(safe-area-inset-bottom))" }}>
      {/* шапка внутри скролла: уезжает вверх, лист остаётся прилипшим */}
      <div className="board" ref={boardRef} onScroll={onScrollBoard}>
        <div className="deck-top">
          <button className="back" onClick={onBack} aria-label="Назад">←</button>
          <div className="dilemma-line" style={sq(draft.dilemma)}>{draft.dilemma}</div>
          <button className="icon-btn go" style={sq("далее")} onClick={onDone}>далее →</button>
        </div>
        <div className="qline">{QUESTION[phase]}</div>

        <div className={`paper lenspaper${thud ? " thud" : ""}`}>
          <div className="phalf a">
            <div className="ptag">А · {draft.options[0].label}</div>
            <div className="pile">{draft.options[0].picks.map(cell)}</div>
          </div>
          <div className="fold">
            <div className="pile">{draft.shared.map(cell)}</div>
          </div>
          <div className="phalf b">
            <div className="ptag">Б · {draft.options[1].label}</div>
            <div className="pile">{draft.options[1].picks.map(cell)}</div>
          </div>
        </div>

        <div className="thint">перетащи {isF ? "чувство" : "ценность"} на пирамидку ↑</div>

        <div className="tscale" style={{ height: tableH * SCALE }}>
          <div className="table" style={{ height: tableH, transform: `scale(${SCALE})` }}>
            <GroupMarks blobs={blobs} />
            {spots.map((s) => {
              const tone = toneOf(s.word);
              return (
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
                    className={`ltri ${tone}`}
                    style={{ transform: `rotate(${jit(s.word, "t", 16)}deg)` }}
                    onPointerDown={(e) => grab(e, s.word, tone)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onCancel}
                  />
                  <div className="tlabel">{s.word}</div>
                </div>
              );
            })}
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
          <div className={`ltri ${(gone ?? drag)!.tone}`} />
          <div className="tlabel">{(gone ?? drag)!.word}</div>
        </div>
      )}

      {zp.zoom && <Zoom word={zp.zoom.word} bg={zp.zoom.bg} onClose={zp.close} />}
    </div>
  );
}
