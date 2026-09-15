import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
  head: () => ({ meta: [{ title: "Entrar · Painel KYT" }] }),
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const response = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
      const data = (await response.json()) as { authenticated?: boolean; setupRequired?: boolean };
      if (cancelled) return;
      if (data.authenticated) {
        await navigate({ to: "/admin" });
        return;
      }
      setSetup(Boolean(data.setupRequired));
      setBooting(false);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (setup && password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(setup ? "/api/admin/setup" : "/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !data.ok) {
        setError(data.message || "Não foi possível entrar.");
        return;
      }
      await navigate({ to: "/admin" });
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  if (booting) {
    return <div className="min-h-screen bg-[#070709]" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070709] px-4">
      <form onSubmit={(event) => void onSubmit(event)} className="w-full max-w-md border border-white/10 bg-[#0c0c10] p-8">
        <img src="/logo-kyt.svg" alt="KYT" className="h-10 w-auto" />
        <p className="mt-6 font-display text-xs font-bold tracking-[0.2em] text-[#CC2222] uppercase">Painel KYT</p>
        <h1 className="mt-2 font-display text-4xl font-black uppercase">
          {setup ? "Criar senha" : "Entrar"}
        </h1>
        <p className="mt-2 text-sm text-[#6A6A6A]">
          {setup
            ? "Defina a senha do painel desta loja. Ela fica só neste servidor."
            : "Uma plataforma para operar a loja, os pedidos e o rastreio."}
        </p>
        <label className="mt-8 block">
          <span className="mb-2 block text-xs tracking-wide text-[#6A6A6A] uppercase">Senha</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            className="h-12 w-full border border-white/15 bg-transparent px-3 outline-none focus:border-[#CC2222]"
          />
        </label>
        {setup ? (
          <label className="mt-4 block">
            <span className="mb-2 block text-xs tracking-wide text-[#6A6A6A] uppercase">Confirmar senha</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              className="h-12 w-full border border-white/15 bg-transparent px-3 outline-none focus:border-[#CC2222]"
            />
          </label>
        ) : null}
        {error ? <p className="mt-4 text-sm text-[#CC2222]">{error}</p> : null}
        <button type="submit" disabled={loading} className="kyt-btn kyt-btn-primary mt-6 w-full">
          {loading ? "Entrando..." : setup ? "Criar painel" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
