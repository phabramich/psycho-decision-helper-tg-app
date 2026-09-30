import { useState } from "react";
import { FEELINGS_MET, FEELINGS_UNMET, VALUES } from "./data.ts";
import type { Custom, Pick } from "./types.ts";
import { Pill, Sheet } from "./components.tsx";

export function LensSheet({
  pick,
  custom,
  addCustom,
  onToggle,
  onRemove,
  onClose,
}: {
  pick: Pick;
  custom: Custom;
  addCustom: (kind: keyof Custom, word: string) => string;
  onToggle: (field: "feelings" | "values", v: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const f = (w: string) => w.toLowerCase().includes(q.toLowerCase());
  const met = [...FEELINGS_MET, ...custom.feelings].filter(f);
  const unmet = FEELINGS_UNMET.filter(f);
  const vals = [...VALUES, ...custom.values].filter(f);
  const ql = q.trim().toLowerCase();
  return (
    <Sheet
      title={
        <span className="lens-title">
          <span className="tri-ico">▲</span> {pick.need}
        </span>
      }
      onClose={onClose}
    >
      <input
        className="sheet-search"
        type="text"
        placeholder="найти…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />

      <div className="sect">что чувствую</div>
      <div className="pills">
        {met.map((w) => (
          <Pill key={w} label={w} tone="met" sel={pick.feelings.includes(w)} onClick={() => onToggle("feelings", w)} />
        ))}
      </div>
      <div className="pills" style={{ marginTop: 8 }}>
        {unmet.map((w) => (
          <Pill key={w} label={w} tone="unmet" sel={pick.feelings.includes(w)} onClick={() => onToggle("feelings", w)} />
        ))}
        {ql && ![...met, ...unmet].includes(ql) && (
          <Pill label={`+ «${q.trim()}»`} dashed onClick={() => onToggle("feelings", addCustom("feelings", q))} />
        )}
      </div>

      <div className="sect">за какой ценностью стоит</div>
      <div className="pills">
        {vals.map((w) => (
          <Pill key={w} label={w} tone="val" sel={pick.values.includes(w)} onClick={() => onToggle("values", w)} />
        ))}
        {ql && !vals.includes(ql) && (
          <Pill label={`+ «${q.trim()}»`} dashed onClick={() => onToggle("values", addCustom("values", q))} />
        )}
      </div>

      {onRemove && (
        <button className="btn danger" style={{ width: "100%", marginTop: 18 }} onClick={onRemove}>
          убрать со стола
        </button>
      )}
    </Sheet>
  );
}
