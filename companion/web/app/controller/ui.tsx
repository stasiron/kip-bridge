"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Shell({ children, accent }: { children: ReactNode; accent?: string }) {
  return (
    <div
      className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]"
      style={
        accent
          ? {
              background: `radial-gradient(120% 80% at 50% -10%, ${accent}33, transparent 55%), linear-gradient(165deg, #07141f 0%, #0c1c2a 48%, #122433 100%)`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <h1 className="font-display text-3xl font-bold tracking-tight text-cyan-50">{children}</h1>;
}

export function Sub({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-slate-300">{children}</p>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`mt-5 space-y-3 rounded-none border border-cyan-900/50 bg-slate-950/55 p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300/90">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full border border-slate-600 bg-slate-900 px-3 py-3 text-base text-slate-50 outline-none ring-teal-400/40 placeholder:text-slate-500 focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-coral-500 text-slate-950 hover:brightness-110 disabled:opacity-40",
    secondary: "border border-teal-500/70 bg-teal-950/40 text-teal-100 hover:bg-teal-900/50 disabled:opacity-40",
    danger: "border border-rose-500/60 bg-rose-950/50 text-rose-100 disabled:opacity-40",
    ghost: "border border-slate-600 bg-transparent text-slate-200 hover:bg-slate-900 disabled:opacity-40",
  }[variant];
  return (
    <button
      type="button"
      {...props}
      className={`min-h-12 w-full px-4 py-3 text-sm font-semibold tracking-wide transition active:scale-[0.99] ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function StatusChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center border border-teal-700/60 bg-teal-950/50 px-2.5 py-1 text-xs font-medium text-teal-100">
      {children}
    </span>
  );
}

export function ErrorBanner({
  code,
  detail,
  hint,
  onDismiss,
}: {
  code: string;
  detail: string;
  hint: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      data-testid="bridge-error"
      className="mt-4 border border-rose-500/50 bg-rose-950/40 p-3 text-sm text-rose-100"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{hint}</p>
          <p className="mt-1 font-mono text-xs text-rose-200/80">
            {code}: {detail}
          </p>
        </div>
        {onDismiss ? (
          <button type="button" className="text-xs underline" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  return (
    <div className="mt-3 h-2 w-full overflow-hidden bg-slate-800" aria-hidden>
      <div className="h-full bg-coral-400 transition-[width] duration-100 ease-linear" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AnswerGrid({
  answers,
  disabled,
  selected,
  onSelect,
}: {
  answers: { id: string | number; label: string }[];
  disabled?: boolean;
  selected?: string | number | null;
  onSelect: (id: string | number) => void;
}) {
  return (
    <div className="mt-4 grid gap-2">
      {answers.map((answer) => {
        const active = selected === answer.id;
        return (
          <button
            key={String(answer.id)}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(answer.id)}
            className={`min-h-14 border px-4 py-3 text-left text-base font-medium transition ${
              active
                ? "border-coral-400 bg-coral-500/20 text-coral-100"
                : "border-slate-600 bg-slate-900/80 text-slate-50 active:bg-slate-800"
            } disabled:opacity-50`}
          >
            {answer.label}
          </button>
        );
      })}
    </div>
  );
}
