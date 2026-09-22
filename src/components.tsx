import type { ReactNode } from "react";

export function Pill({
  label,
  tone = "plain",
  sel,
  onClick,
  dashed,
}: {
  label: string;
  tone?: "met" | "unmet" | "val" | "plain";
  sel?: boolean;
  onClick?: () => void;
  dashed?: boolean;
}) {
  return (
    <button className={`pill ${tone}${sel ? " sel" : ""}${dashed ? " add" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="sheet-x" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
