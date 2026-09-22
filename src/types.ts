export interface Pick {
  need: string;
  feelings: string[];
  values: string[];
}

export interface Option {
  label: string;
  picks: Pick[];
}

export interface Draft {
  dilemma: string;
  options: [Option, Option];
  shared: Pick[]; // потребности, которым хорошо в любом варианте
  skipped: string[]; // сброшенные карты
  note: string;
  leaning: 0 | 1 | null;
}

export interface Session extends Draft {
  id: string;
  ts: number;
}

export interface Custom {
  needs: string[];
  feelings: string[];
  values: string[];
}

export type Screen = "home" | "setup" | "deck" | "lenses" | "summary" | "view";
