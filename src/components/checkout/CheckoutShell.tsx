import { Link } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { PixIcon } from "@/components/checkout/parts";

/** Layout focado das páginas de compra: logo centralizada, conteúdo e rodapé de segurança. */
export function CheckoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#080808] text-[#F0F0F0]">
      <header className="flex items-center justify-center gap-3 border-b border-white/10 py-5 md:py-6">
        <Link to="/" aria-label="KYT Capacetes Brasil">
          <img src="/logo-kyt.svg" alt="KYT Capacetes Brasil" className="h-8 w-auto sm:h-9" />
        </Link>
        <span className="hidden items-center gap-1.5 border border-white/15 px-2 py-1 font-display text-[10px] font-bold tracking-[0.16em] text-[#6A6A6A] uppercase sm:flex">
          <Lock className="h-3 w-3" /> Compra segura
        </span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-10 border-t border-white/10 bg-[#050505] px-4 py-8 text-center text-xs text-[#6A6A6A]">
        <p className="font-display text-sm font-bold tracking-[0.16em] text-[#F0F0F0] uppercase">KYT Capacetes Brasil</p>
        <p className="mt-2">© {new Date().getFullYear()} · Todos os direitos reservados</p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="flex h-7 items-center gap-1.5 border border-white/15 px-2 font-display text-[11px] font-bold tracking-wider text-[#F0F0F0]">
            <PixIcon className="h-3.5 w-3.5" /> PIX
          </span>
          <span className="flex h-7 items-center gap-1.5 border border-white/15 px-2 font-display text-[11px] font-bold tracking-wider text-[#F0F0F0]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> 100% SEGURO
          </span>
        </div>
      </footer>
    </div>
  );
}
