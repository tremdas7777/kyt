import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Activity, LayoutDashboard, LogOut, Menu, Plug, Radio, ShoppingBag, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { adminJson } from "@/lib/admin-fetch";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/admin", label: "Painel", icon: LayoutDashboard },
  { to: "/admin/ao-vivo", label: "Ao vivo", icon: Radio },
  { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/admin/integracoes", label: "Integrações", icon: Plug },
  { to: "/admin/eventos", label: "Eventos", icon: Activity },
] as const;

export function AdminShell({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [bootError, setBootError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setBootError("");
      const data = await adminJson<{ authenticated?: boolean }>("/api/admin/session", {}, 7000);
      if (cancelled) return;
      if (data?.authenticated) {
        setReady(true);
        return;
      }
      if (data) {
        await navigate({ to: "/admin/login" });
        return;
      }
      setBootError("O painel demorou para responder.");
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    await navigate({ to: "/admin/login" });
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#070709] px-6 text-[#F0F0F0]">
        <p className="font-display text-sm tracking-[0.18em] uppercase text-[#6A6A6A]">
          {bootError || "Carregando painel…"}
        </p>
        {bootError ? (
          <button
            type="button"
            className="text-xs uppercase tracking-widest text-[#CC2222]"
            onClick={() => {
              setBootError("");
              window.location.reload();
            }}
          >
            Tentar de novo
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070709] text-[#F0F0F0]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] border-r border-white/8 bg-[#0c0c10] px-5 py-6 transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link to="/admin" className="mb-8 flex items-center gap-3 px-2">
          <img src="/logo-kyt.svg" alt="KYT" className="h-8 w-auto" />
          <div>
            <p className="font-display text-sm font-black tracking-[0.16em] uppercase">Painel KYT</p>
            <p className="text-[11px] text-[#6A6A6A]">Commerce OS</p>
          </div>
        </Link>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  active ? "bg-[#CC2222] text-white" : "text-[#B8B8B8] hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          type="button"
          onClick={() => void logout()}
          className="absolute bottom-6 left-5 right-5 flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-[#6A6A6A] hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      {open ? <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} /> : null}

      <div className="md:pl-[280px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/8 bg-[#070709]/90 px-4 backdrop-blur-md md:px-8">
          <button type="button" className="md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <p className="font-display text-xs font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">Loja oficial · capacetekyt.com.br</p>
          <a href="/" className="text-xs text-[#6A6A6A] hover:text-white">
            Ver loja
          </a>
        </header>
        <div className="px-4 py-8 lg:px-8">{children ?? <Outlet />}</div>
      </div>
    </div>
  );
}
