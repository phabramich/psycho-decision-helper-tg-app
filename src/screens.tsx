import { useState } from "react";
import { FEELINGS_UNMET } from "./data.ts";
import { tg, haptic } from "./tg.ts";
import type { Custom, Draft, Pick, Session } from "./types.ts";
import { LensSheet } from "./LensSheet.tsx";

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

export function Home({ sessions, onNew, onOpen }: { sessions: Session[]; onNew: () => void; onOpen: (id: string) => void }) {
  const name = tg?.initDataUnsafe?.user?.first_name;
  return (
    <div className="screen">
      <div className="hero">
        <div className="prism">◭</div>
        <h1>ПРИЗМА</h1>
        <p className="sub">
          {name ? `${name}, р` : "Р"}азложи свой выбор колодой: смахивай потребности в сторону варианта,
          который их накормит. Мимо — тоже ход.
        </p>
      </div>
      <button className="btn" onClick={onNew}>
        Новый расклад →
      </button>
      <div className="hist">
        {sessions.length === 0 && <div className="empty">Пока пусто. Первый расклад появится здесь.</div>}
        {[...sessions].sort((a, b) => b.ts - a.ts).map((s) => (
          <button key={s.id} className="hcard" onClick={() => onOpen(s.id)}>
            <div className="d">
              {fmtDate(s.ts)}
              {s.leaning !== null ? ` → ${s.options[s.leaning]!.label}` : ""}
            </div>
            <div className="t">{s.dilemma}</div>
            <div className="m">
              {s.options[0]!.label}: {s.options[0]!.picks.length} ▲ · {s.options[1]!.label}: {s.options[1]!.picks.length} ▲
              {s.shared?.length ? ` · обоим ${s.shared.length}` : ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Setup({ draft, setDraft, onNext }: { draft: Draft; setDraft: (d: Draft) => void; onNext: () => void }) {
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
      <h2>Что за выбор?</h2>
      <p className="sub">Одна фраза: «делиться ли творчеством», «менять ли работу», «начать ли разговор».</p>
      <textarea rows={3} placeholder="Мой выбор: …" value={d.dilemma} onChange={(e) => setD({ ...d, dilemma: e.target.value })} autoFocus />
      <div>
        <label className="fld">Вариант А — если сделаю (свайп вправо)</label>
        <div className="optname">
          <span className="badge a">А</span>
          <input type="text" value={d.options[0].label} placeholder="делаю" onChange={(e) => setD({ ...d, options: [{ ...d.options[0], label: e.target.value }, d.options[1]] })} />
        </div>
        <label className="fld">Вариант Б — если не сделаю (свайп влево)</label>
        <div className="optname">
          <span className="badge b">Б</span>
          <input type="text" value={d.options[1].label} placeholder="не делаю" onChange={(e) => setD({ ...d, options: [d.options[0], { ...d.options[1], label: e.target.value }] })} />
        </div>
      </div>
      <div className="bar">
        <button className="btn" disabled={!ok} onClick={commit}>
          Раздать колоду →
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
}: {
  draft: Draft;
  setDraft: (fn: (d: Draft) => Draft) => void;
  custom: Custom;
  addCustom: (kind: keyof Custom, word: string) => string;
  onSave: () => void;
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
  return (
    <div className="screen">
      <h2>{draft.dilemma}</h2>
      <OptCard title={`А · ${draft.options[0].label}`} cls="oa" picks={draft.options[0].picks} onPick={(pk) => setEditing({ pile: 0, need: pk.need })} />
      <OptCard title={`Б · ${draft.options[1].label}`} cls="ob" picks={draft.options[1].picks} onPick={(pk) => setEditing({ pile: 1, need: pk.need })} />
      {draft.shared.length > 0 && (
        <OptCard title="Обоим подходит — не решающий фактор" cls="os" picks={draft.shared} onPick={(pk) => setEditing({ pile: "shared", need: pk.need })} />
      )}
      {draft.skipped.length > 0 && <p className="dim">мимо пролетело: {draft.skipped.length} карт</p>}

      <div>
        <div className="sect">К чему склоняешься?</div>
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
        placeholder="Что я понял(а), разложив этот выбор…"
        value={draft.note}
        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
      />
      <div className="bar">
        <button className="btn" onClick={onSave}>
          Сохранить расклад
        </button>
      </div>

      {editing && p && (
        <LensSheet pick={p} custom={custom} addCustom={addCustom} onToggle={toggle} onRemove={remove} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

export function SessionView({ s, onDelete }: { s: Session; onDelete: () => void }) {
  return (
    <div className="screen">
      <p className="sub">{fmtDate(s.ts)}</p>
      <h2>{s.dilemma}</h2>
      <OptCard title={`А · ${s.options[0]!.label}`} cls="oa" picks={s.options[0]!.picks} />
      <OptCard title={`Б · ${s.options[1]!.label}`} cls="ob" picks={s.options[1]!.picks} />
      {!!s.shared?.length && <OptCard title="Обоим подходит" cls="os" picks={s.shared} />}
      {!!s.skipped?.length && <p className="dim">мимо пролетело: {s.skipped.length} карт</p>}
      {s.leaning !== null && s.leaning !== undefined && <p className="sub">Склонение: {s.options[s.leaning]!.label}</p>}
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
