import { useEffect, useMemo, useRef, useState } from "react";
import { FEELINGS_MET, FEELINGS_UNMET, needBg, VALUES } from "./data.ts";
import { haptic } from "./tg.ts";
import type { Custom, Draft, Pick } from "./types.ts";

type Pile = 0 | 1 | "shared";
interface QItem {
  pile: Pile;
  need: string;
}
type Phase = "feelings" | "values";

const shuffle = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
};
const HEAVY = new Set(FEELINGS_UNMET);

export function Lenses({
  draft,
  setDraft,
  custom,
  addCustom,
  onDone,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  custom: Custom;
  addCustom: (kind: keyof Custom, word: string) => string;
  onDone: () => void;
}) {
  const queue = useRef<QItem[]>([
    ...draft.options[0].picks.map((p) => ({ pile: 0 as const, need: p.need })),
    ...draft.options[1].picks.map((p) => ({ pile: 1 as const, need: p.need })),
    ...draft.shared.map((p) => ({ pile: "shared" as const, need: p.need })),
  ]).current;

  const [pi, setPi] = useState(0);
  const [phase, setPhase] = useState<Phase>("feelings");
  const [ci, setCi] = useState(0);
  const [tr, setTr] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<{ word: string; tone: string; up: boolean } | null>(null);
  const [own, setOwn] = useState("");
  const [ownOpen, setOwnOpen] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const feelingsDeck = useMemo(() => shuffle([...FEELINGS_MET, ...custom.feelings, ...FEELINGS_UNMET]), [pi]);
  const valuesDeck = useMemo(() => shuffle([...VALUES, ...custom.values]), [pi]);
  const deck = phase === "feelings" ? feelingsDeck : valuesDeck;

  const cur = queue[pi];
  const live: Pick | undefined = cur
    ? (cur.pile === "shared" ? draft.shared : draft.options[cur.pile].picks).find((p) => p.need === cur.need)
    : undefined;
  const lensWord = ci < deck.length ? deck[ci]! : null;

  useEffect(() => {
    if (queue.length === 0) onDone();
  }, [queue.length, onDone]);
  const tone = phase === "values" ? "val" : HEAVY.has(lensWord ?? "") ? "unmet" : "met";

  const attach = (v: string, field: Phase) => {
    if (!cur) return;
    haptic();
    setDraft((d) => {
      const edit = (arr: Pick[]) =>
        arr.map((p) => (p.need === cur.need && !p[field].includes(v) ? { ...p, [field]: [...p[field], v] } : p));
      if (cur.pile === 0) return { ...d, options: [{ ...d.options[0], picks: edit(d.options[0].picks) }, d.options[1]] };
      if (cur.pile === 1) return { ...d, options: [d.options[0], { ...d.options[1], picks: edit(d.options[1].picks) }] };
      return { ...d, shared: edit(d.shared) };
    });
  };

  const next = () => {
    setOwnOpen(false);
    setOwn("");
    if (phase === "feelings") {
      setPhase("values");
      setCi(0);
    } else if (pi + 1 >= queue.length) {
      onDone();
    } else {
      setPi(pi + 1);
      setPhase("feelings");
      setCi(0);
    }
  };

  const fire = (up: boolean) => {
    if (!lensWord || !cur) return;
    setFlying({ word: lensWord, tone, up });
    if (up) attach(lensWord, phase);
    setTimeout(() => setFlying(null), 300);
    if (ci + 1 >= deck.length) next();
    else setCi(ci + 1);
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!lensWord || flying) return;
    drag.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setTr({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    const { y } = tr;
    setTr({ x: 0, y: 0 });
    if (y < -70) fire(true);
    else if (y > 80) fire(false);
  };

  const addOwn = () => {
    const w = own.trim().toLowerCase();
    if (!w || !cur) return;
    addCustom(phase, w);
    attach(w, phase);
    setOwn("");
    setOwnOpen(false);
  };

  const pileTag = cur ? (cur.pile === 0 ? "А" : cur.pile === 1 ? "Б" : "≈") : "";
  const pileColor = cur?.pile === 0 ? "var(--A)" : cur?.pile === 1 ? "var(--B)" : "var(--met)";

  return (
    <div className="screen" style={{ minHeight: "calc(100dvh - 130px)" }}>
      <div className="dilemma-line">{draft.dilemma}</div>
      <div className="deck-top">
        <div className="counts">
          <span className="cs">
            потребность {Math.min(pi + 1, queue.length)}/{queue.length} · линза: {phase === "feelings" ? "чувства" : "ценности"}
          </span>
        </div>
        <button className="icon-btn" onClick={next}>далее →</button>
        <button className="icon-btn" onClick={onDone}>сводка →</button>
      </div>

      {/* базовая карта с наслоёнными линзами */}
      <div className="basecard">
        <span className="pile-tag" style={{ background: pileColor }}>{pileTag}</span>
        <div
          className="tri-big"
          style={{ background: needBg(cur?.need ?? "") }}
        />
        <div className="tri-word">{cur?.need}</div>
        <div className="overlay-chips">
          {live?.feelings.map((f) => (
            <span key={f} className={`lenschip ${HEAVY.has(f) ? "unmet" : "met"}`}>{f}</span>
          ))}
          {live?.values.map((v) => (
            <span key={v} className="lenschip val">{v}</span>
          ))}
          {live && live.feelings.length + live.values.length === 0 && <span className="dim">пока без линз — накинь снизу</span>}
        </div>
      </div>

      {/* колода линз */}
      <div className="lensdeck">
        {lensWord ? (
          <>
            {ci + 1 < deck.length && <div className="lensunder" />}
            <div
              key={`${pi}-${phase}-${ci}`}
              className={`dcard lens ${tone}${dragging ? " drag" : ""}`}
              style={{ transform: `translate(${tr.x}px, ${tr.y}px) rotate(${tr.x / 16}deg)` }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => { drag.current = null; setDragging(false); setTr({ x: 0, y: 0 }); }}
            >
              <div className="tri-lens" />
              <div className="tri-word">{lensWord}</div>
              <div className="hint">↑ на карту · ↓ мимо</div>
            </div>
          </>
        ) : null}
        {flying && (
          <div
            className={`dcard lens ${flying.tone} fly`}
            style={{ transform: `translateY(${flying.up ? "-320px" : "320px"}) scale(${flying.up ? 0.55 : 1})`, opacity: flying.up ? 0.9 : 0 }}
          >
            <div className="tri-lens" />
            <div className="tri-word">{flying.word}</div>
          </div>
        )}
      </div>

      <div className="lensctl">
        <button className="icon-btn" onClick={() => fire(false)} disabled={!lensWord}>мимо ↓</button>
        <button className="icon-btn" onClick={() => setOwnOpen(!ownOpen)}>＋ своё</button>
        <button className="icon-btn" onClick={() => fire(true)} disabled={!lensWord}>на карту ↑</button>
      </div>
      {ownOpen && (
        <div className="optname">
          <input
            type="text"
            placeholder={phase === "feelings" ? "моё чувство…" : "моя ценность…"}
            value={own}
            onChange={(e) => setOwn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOwn()}
            autoFocus
          />
          <button className="icon-btn" onClick={addOwn}>ок</button>
        </div>
      )}
    </div>
  );
}
