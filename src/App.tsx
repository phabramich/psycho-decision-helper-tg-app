import { useCallback, useEffect, useState } from "react";
import { Deck } from "./Deck.tsx";
import { Lenses } from "./Lenses.tsx";
import { Home, SessionView, Setup, Summary } from "./screens.tsx";
import { backButton, hapticOk, storage, tg } from "./tg.ts";
import type { Custom, Draft, Screen, Session } from "./types.ts";

const emptyDraft = (): Draft => ({
  dilemma: "",
  options: [
    { label: "", picks: [] },
    { label: "", picks: [] },
  ],
  shared: [],
  skipped: [],
  note: "",
  leaning: null,
});

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [custom, setCustom] = useState<Custom>({ needs: [], feelings: [], values: [] });
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [viewId, setViewId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([storage.get("sessions"), storage.get("custom")]).then(([s, c]) => {
      try {
        if (s) setSessions(JSON.parse(s));
        if (c) setCustom(JSON.parse(c));
      } catch {
        /* битый кэш — начнём с чистого листа */
      }
      setLoaded(true);
    });
  }, []);

  const back = useCallback(() => {
    const hasPicks =
      draft.options[0].picks.length + draft.options[1].picks.length + draft.shared.length > 0;
    setScreen((s) =>
      s === "deck" ? "setup"
      : s === "feelings" ? "deck"
      : s === "values" ? "feelings"
      : s === "summary" ? (hasPicks ? "values" : "deck")
      : "home",
    );
  }, [draft]);

  useEffect(() => {
    const bb = backButton;
    if (!bb) return;
    bb.onClick(back);
    return () => bb.offClick(back);
  }, [back]);

  useEffect(() => {
    if (!backButton) return;
    if (screen === "home") backButton.hide();
    else backButton.show();
  }, [screen]);

  const addCustom = (kind: keyof Custom, word: string): string => {
    const w = word.trim().toLowerCase();
    if (!w || custom[kind].includes(w)) return w;
    const next = { ...custom, [kind]: [...custom[kind], w] };
    setCustom(next);
    void storage.set("custom", JSON.stringify(next));
    return w;
  };

  const saveDraft = () => {
    const s: Session = { ...draft, id: Date.now().toString(36), ts: Date.now() };
    const next = [...sessions, s];
    setSessions(next);
    void storage.set("sessions", JSON.stringify(next));
    hapticOk();
    setDraft(emptyDraft());
    setScreen("home");
  };

  const delSession = (id: string) => {
    const next = sessions.filter((x) => x.id !== id);
    setSessions(next);
    void storage.set("sessions", JSON.stringify(next));
    setScreen("home");
  };

  if (!loaded) return null;

  const fixed = screen === "deck" || screen === "feelings" || screen === "values";
  return (
    <div id="wrap" style={fixed ? { paddingBottom: 0 } : undefined}>
      {screen === "home" && (
        <Home
          sessions={sessions}
          onNew={() => {
            setDraft(emptyDraft());
            setScreen("setup");
          }}
          onOpen={(id) => {
            setViewId(id);
            setScreen("view");
          }}
          onDelete={delSession}
        />
      )}
      {screen === "setup" && <Setup draft={draft} setDraft={setDraft} onNext={() => setScreen("deck")} onBack={back} />}
      {screen === "deck" && (
        <Deck draft={draft} setDraft={setDraft} custom={custom} onDone={() => setScreen("feelings")} onBack={back} />
      )}
      {screen === "feelings" && (
        <Lenses
          draft={draft}
          setDraft={setDraft}
          custom={custom}
          phase="feelings"
          onDone={() => setScreen("values")}
          onBack={back}
        />
      )}
      {screen === "values" && (
        <Lenses
          draft={draft}
          setDraft={setDraft}
          custom={custom}
          phase="values"
          onDone={() => setScreen("summary")}
          onBack={back}
        />
      )}
      {screen === "summary" && <Summary draft={draft} setDraft={setDraft} custom={custom} addCustom={addCustom} onSave={saveDraft} onBack={back} />}
      {screen === "view" &&
        (() => {
          const s = sessions.find((x) => x.id === viewId);
          return s ? <SessionView s={s} onDelete={() => delSession(s.id)} onBack={back} /> : null;
        })()}
    </div>
  );
}
