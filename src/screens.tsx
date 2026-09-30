import { useState } from "react";
import { FEELINGS_UNMET } from "./data.ts";
import { haptic } from "./tg.ts";
import { sq } from "./components.tsx";
import type { Custom, Draft, Pick, Session } from "./types.ts";
import { LensSheet } from "./LensSheet.tsx";

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function Home({ sessions, onNew, onOpen, onDelete }: { sessions: Session[]; onNew: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  return (
    <div className="screen">
      <div className="hero">
        <div className="prism">◭</div>
        <h1>Призма</h1>
      </div>
      <div className="hist">
        {[...sessions].sort((a, b) => b.ts - a.ts).map((s) => (
          <div key={s.id} className="hcard" onClick={() => onOpen(s.id)}>
            <div className="d">
              {fmtDate(s.ts)}
              {s.leaning !== null ? ` → ${s.options[s.leaning]!.label}` : ""}
            </div>
            <div className="t">{s.dilemma}</div>
            <div className="m">
              {s.options[0]!.label}: {s.options[0]!.picks.length} ▲ · {s.options[1]!.label}: {s.options[1]!.picks.length} ▲
              {s.shared?.length ? ` · обоим ${s.shared.length}` : ""}
            </div>
            <button
              className="hdel"
              aria-label="Удалить"
              onClick={(e) => {
                e.stopPropagation();
                haptic();
                onDelete(s.id);
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="bar">
        <button className="btn" style={sq(sessions.length ? "новая дилемма" : "начать")} onClick={onNew}>
          {sessions.length ? "новая дилемма" : "начать"}
        </button>
      </div>
    </div>
  );
}

export function Setup({ draft, setDraft, onNext, onBack }: { draft: Draft; setDraft: (d: Draft) => void; onNext: () => void; onBack: () => void }) {
  const [d, setD] = useState(draft);
  const ok = d.dilemma.trim().length > 0;
  const commit = () => {
    setDraft({
      ...d,
      dilemma: d.dilemma.trim(),
      options: [
        { ...d.options[0], label: d.options[0].label.trim() || "делаю это" },
        { ...d.options[1], label: d.options[1].label.trim() || "не делаю этого" },
      ],
    });
    onNext();
  };
  return (
    <div className="screen">
      <button className="back" onClick={onBack} aria-label="Назад">←</button>
      <h2>Из чего выбираешь?</h2>
      <p className="sub">Одна фраза: «делиться ли творчеством», «менять ли работу», «начать ли разговор».</p>
      <textarea rows={3} placeholder="Моя дилемма: …" value={d.dilemma} onChange={(e) => setD({ ...d, dilemma: e.target.value })} autoFocus />
      <div>
        <label className="fld">Вариант А · слева на листе</label>
        <div className="optname">
          <span className="badge a">А</span>
          <input type="text" value={d.options[0].label} placeholder="делаю" onChange={(e) => setD({ ...d, options: [{ ...d.options[0], label: e.target.value }, d.options[1]] })} />
        </div>
        <label className="fld">Вариант Б · справа на листе</label>
        <div className="optname">
          <span className="badge b">Б</span>
          <input type="text" value={d.options[1].label} placeholder="не делаю" onChange={(e) => setD({ ...d, options: [d.options[0], { ...d.options[1], label: e.target.value }] })} />
        </div>
      </div>
      <div className="bar">
        <button className="btn" style={sq("далее")} disabled={!ok} onClick={commit}>
          далее →
        </button>
      </div>
    </div>
  );
}

function PickBlock({ p, onClick }: { p: Pick; onClick?: () => void }) {
  return (
    <div className="needrow" onClick={onClick}>
      <div className="needname">{p.need}</div>
      <div className="minichips">
        {p.feelings.map((f) => (
          <span key={f} className={`minichip ${FEELINGS_UNMET.includes(f) ? "unmet" : "met"}`}>{f}</span>
        ))}
        {p.values.map((v) => (
          <span key={v} className="minichip val">◆ {v}</span>
        ))}
        {p.feelings.length + p.values.length === 0 && <span className="dim">—</span>}
      </div>
    </div>
  );
}

function OptCard({ title, cls, picks, onPick }: { title: string; cls: string; picks: Pick[]; onPick?: (p: Pick) => void }) {
  return (
    <div className={`optcard ${cls}`}>
      <h3>{title}</h3>
      {picks.length ? picks.map((p) => <PickBlock key={p.need} p={p} onClick={onPick ? () => onPick(p) : undefined} />) : <div className="empty">пусто</div>}
    </div>
  );
}

export function Summary({
  draft,
  setDraft,
  custom,
  addCustom,
  onSave,
  onBack,
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  custom: Custom;
  addCustom: (kind: keyof Custom, word: string) => string;
  onSave: () => void;
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<{ pile: 0 | 1 | "shared"; need: string } | null>(null);

  const findPick = (): Pick | undefined => {
    if (!editing) return undefined;
    const arr = editing.pile === "shared" ? draft.shared : draft.options[editing.pile].picks;
    return arr.find((p) => p.need === editing.need);
  };

  const toggle = (field: "feelings" | "values", v: string) => {
    if (!editing) return;
    haptic();
    setDraft((d) => {
      const edit = (o: { picks: Pick[] }) => ({
        ...o,
        picks: o.picks.map((p) => (p.need === editing.need ? { ...p, [field]: p[field].includes(v) ? p[field].filter((x) => x !== v) : [...p[field], v] } : p)),
      });
      if (editing.pile === 0) return { ...d, options: [edit(d.options[0]), d.options[1]] as Draft["options"] };
      if (editing.pile === 1) return { ...d, options: [d.options[0], edit(d.options[1])] as Draft["options"] };
      return { ...d, shared: edit({ picks: d.shared }).picks };
    });
  };

  const remove = () => {
    if (!editing) return;
    setDraft((d) => {
      const cut = (arr: Pick[]) => arr.filter((p) => p.need !== editing.need);
      if (editing.pile === 0) return { ...d, options: [{ ...d.options[0], picks: cut(d.options[0].picks) }, d.options[1]] };
      if (editing.pile === 1) return { ...d, options: [d.options[0], { ...d.options[1], picks: cut(d.options[1].picks) }] };
      return { ...d, shared: cut(d.shared) };
    });
    setEditing(null);
  };

  const p = findPick();
  const hasPicks = draft.options[0].picks.length + draft.options[1].picks.length + draft.shared.length > 0;
  return (
    <div className="screen">
      <button className="back" onClick={onBack} aria-label="Назад">←</button>
      <h2>{draft.dilemma}</h2>
      <OptCard title={`А · ${draft.options[0].label}`} cls="oa" picks={draft.options[0].picks} onPick={(pk) => setEditing({ pile: 0, need: pk.need })} />
      <OptCard title={`Б · ${draft.options[1].label}`} cls="ob" picks={draft.options[1].picks} onPick={(pk) => setEditing({ pile: 1, need: pk.need })} />
      {draft.shared.length > 0 && (
        <OptCard title="Подходит обоим" cls="os" picks={draft.shared} onPick={(pk) => setEditing({ pile: "shared", need: pk.need })} />
      )}
      {hasPicks && <p className="dim">нажми на потребность — поправить чувства и ценности</p>}
      {draft.skipped.length > 0 && <p className="dim">отложено: {draft.skipped.length}</p>}

      <div>
        <div className="sect">Куда тянет?</div>
        <div className="lean">
          {draft.options.map((o, i) => (
            <button key={i} className={`pill${draft.leaning === i ? " sel" : ""}`} onClick={() => { haptic(); setDraft((d) => ({ ...d, leaning: i as 0 | 1 })); }}>
              {o.label}
            </button>
          ))}
          <button className={`pill${draft.leaning === null ? " sel" : ""}`} onClick={() => setDraft((d) => ({ ...d, leaning: null }))}>
            не знаю
          </button>
        </div>
      </div>
      <textarea
        rows={3}
        placeholder="Что стало понятно…"
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
      />
      <div className="bar">
        <button className="btn" style={sq("сохранить")} onClick={onSave}>
          Сохранить
        </button>
      </div>

      {editing && p && (
        <LensSheet pick={p} custom={custom} addCustom={addCustom} onToggle={toggle} onRemove={remove} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

export function SessionView({ s, onDelete, onBack }: { s: Session; onDelete: () => void; onBack: () => void }) {
  return (
    <div className="screen">
      <button className="back" onClick={onBack} aria-label="Назад">←</button>
      <p className="sub">{fmtDate(s.ts)}</p>
      <h2>{s.dilemma}</h2>
      <OptCard title={`А · ${s.options[0]!.label}`} cls="oa" picks={s.options[0]!.picks} />
      <OptCard title={`Б · ${s.options[1]!.label}`} cls="ob" picks={s.options[1]!.picks} />
      {!!s.shared?.length && <OptCard title="Подходит обоим" cls="os" picks={s.shared} />}
      {!!s.skipped?.length && <p className="dim">отложено: {s.skipped.length}</p>}
      {s.leaning !== null && s.leaning !== undefined && <p className="sub">Итог: {s.options[s.leaning]!.label}</p>}
      {s.note && (
        <div className="optcard">
          <div className="t">{s.note}</div>
        </div>
      )}
      <button className="btn danger" onClick={onDelete}>
        Удалить
      </button>
    </div>
  );
}
