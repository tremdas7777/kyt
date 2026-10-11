import { Check, SquarePen } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PixIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("text-[#32BCAD]", className)} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5 7.6 6.9h1.1c.8 0 1.5.3 2 .8L12 9l1.3-1.3c.5-.5 1.2-.8 2-.8h1.1L12 2.5Zm-6.1 6L2.5 12l3.4 3.4h2.2c.4 0 .8-.2 1.1-.5L11 13.1a1.6 1.6 0 0 0-2.2-2.2L7.1 9c-.3-.3-.7-.5-1.1-.5Zm12.2 0h-2.2c-.4 0-.8.2-1.1.5l-1.8 1.8a1.6 1.6 0 0 0 2.2 2.2l1.8 1.8c.3.3.7.5 1.1.5h.1l3.4-3.4-3.5-3.4ZM12 15l-1.3 1.3c-.5.5-1.2.8-2 .8H7.6l4.4 4.4 4.4-4.4h-1.1c-.8 0-1.5-.3-2-.8L12 15Z" />
    </svg>
  );
}

/** Cartão de etapa do checkout: ativo, concluído (verde) ou ainda bloqueado (apagado). */
export function StepCard({
  children,
  done,
  muted,
  className,
}: {
  children: ReactNode;
  done?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border p-5 md:p-6",
        done ? "border-emerald-500/50 bg-emerald-500/[0.04]" : muted ? "border-white/5 bg-[#0c0c0c]" : "border-white/15 bg-[#0e0e0e]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StepHead({
  title,
  step,
  onEdit,
  sub,
  muted,
}: {
  title: string;
  step?: string;
  onEdit?: () => void;
  sub?: string;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn("font-display text-xl font-black uppercase", muted ? "text-[#6A6A6A]" : "text-[#F0F0F0]")}>{title}</h2>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1 font-display text-xs font-bold tracking-[0.12em] text-[#6A6A6A] uppercase hover:text-white"
          >
            Editar <SquarePen className="h-3.5 w-3.5" />
          </button>
        ) : step ? (
          <span className={cn("font-display text-xs font-bold tracking-[0.14em] uppercase", muted ? "text-[#6A6A6A]/70" : "text-[#CC2222]")}>
            {step}
          </span>
        ) : null}
      </div>
      {sub ? <p className={cn("mt-1 text-sm", muted ? "text-[#6A6A6A]/80" : "text-[#6A6A6A]")}>{sub}</p> : null}
    </div>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: ReactNode;
  ok?: boolean;
  prefix?: string;
  wrap?: string;
};

export function Field({ label, ok, prefix, wrap, className, ...rest }: FieldProps) {
  return (
    <label className={cn("block", wrap)}>
      <span className="mb-1.5 block text-xs tracking-wide text-[#6A6A6A] uppercase">{label}</span>
      <span className="relative flex items-center">
        {prefix ? <span className="absolute left-3 text-sm text-[#6A6A6A]">{prefix}</span> : null}
        <input
          {...rest}
          className={cn(
            "h-12 w-full border border-white/15 bg-transparent px-3 text-base outline-none focus:border-[#CC2222] md:text-sm",
            ok && "border-emerald-500/60",
            prefix && "pl-12",
            ok && "pr-9",
            className,
          )}
        />
        {ok ? <Check className="pointer-events-none absolute right-3 h-4 w-4 text-emerald-400" /> : null}
      </span>
    </label>
  );
}

export function PrimaryButton({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cn("kyt-btn kyt-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50", className)}>
      {children}
    </button>
  );
}

export function Radio({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border",
        on ? "border-[#CC2222]" : "border-white/30",
      )}
    >
      {on ? <span className="h-2.5 w-2.5 rounded-full bg-[#CC2222]" /> : null}
    </span>
  );
}
