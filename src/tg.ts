// Обёртка над Telegram WebApp API; в браузере и старых клиентах всё деградирует
// в localStorage/но-оп. Версионные фичи гейтятся через atLeast().
interface TgWebApp {
  version?: string;
  ready(): void;
  expand(): void;
  colorScheme?: string;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  initDataUnsafe?: { user?: { first_name?: string } };
  HapticFeedback?: {
    impactOccurred(style: string): void;
    notificationOccurred(type: string): void;
  };
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  CloudStorage?: {
    getItem(k: string, cb: (e: unknown, v?: string) => void): void;
    setItem(k: string, v: string, cb?: () => void): void;
  };
}

export const tg: TgWebApp | undefined = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;

export function atLeast(v: string): boolean {
  if (!tg?.version) return false;
  const a = tg.version.split(".").map(Number);
  const b = v.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

// Границы версий Bot API: 6.1 — BackButton/HapticFeedback/header colors, 6.9 — CloudStorage.
export const backButton = atLeast("6.1") ? tg?.BackButton : undefined;
const cloud = atLeast("6.9") ? tg?.CloudStorage : undefined;

export function initTg() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  if (tg.colorScheme === "light") document.body.classList.add("light");
  if (atLeast("6.1")) {
    try {
      tg.setHeaderColor?.("#f2ede1");
      tg.setBackgroundColor?.("#f2ede1");
    } catch {
      /* старая версия клиента */
    }
  }
}

export const haptic = () => {
  if (atLeast("6.1")) tg?.HapticFeedback?.impactOccurred("light");
};

export const hapticOk = () => {
  if (atLeast("6.1")) tg?.HapticFeedback?.notificationOccurred("success");
};

export const storage = {
  get: (k: string) =>
    new Promise<string | null>((res) => {
      if (cloud) {
        try {
          cloud.getItem(k, (_e, v) => res(v ?? null));
          return;
        } catch {
          /* падение → localStorage */
        }
      }
      res(localStorage.getItem(k));
    }),
  set: (k: string, v: string) =>
    new Promise<void>((res) => {
      if (cloud) {
        try {
          cloud.setItem(k, v, () => res());
          return;
        } catch {
          /* падение → localStorage */
        }
      }
      localStorage.setItem(k, v);
      res();
    }),
};
