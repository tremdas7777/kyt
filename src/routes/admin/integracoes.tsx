import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { TrackingSettings } from "@/lib/tracking-types";

export const Route = createFileRoute("/admin/integracoes")({
  component: AdminIntegrationsPage,
  head: () => ({ meta: [{ title: "Integrações · Painel KYT" }] }),
});

const empty: TrackingSettings = {
  tiktok: { enabled: false, pixelIds: [], accessToken: "", testEventCode: "", markAsPaidOnPixCreate: false },
  meta: { enabled: false, pixelId: "", accessToken: "", testEventCode: "" },
  google: { enabled: false, measurementId: "", apiSecret: "", adsId: "", adsPurchaseLabel: "" },
};

function AdminIntegrationsPage() {
  const [form, setForm] = useState<TrackingSettings>(empty);
  const [tiktokIds, setTiktokIds] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/tracking", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        const tracking = (json as { tracking?: TrackingSettings }).tracking;
        if (tracking) {
          setForm(tracking);
          setTiktokIds(tracking.tiktok.pixelIds.join("\n"));
        }
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <p className="text-sm text-[#6A6A6A]">Carregando integrações…</p>;
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSaved("");
    try {
      const payload: TrackingSettings = {
        ...form,
        tiktok: {
          ...form.tiktok,
          pixelIds: tiktokIds
            .split(/[,\s]+/)
            .map((id) => id.trim())
            .filter(Boolean),
        },
      };
      const response = await fetch("/api/admin/tracking", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; tracking?: TrackingSettings };
      if (!response.ok || !data.ok) {
        setError(data.message || "Não foi possível salvar.");
        return;
      }
      if (data.tracking) {
        setForm(data.tracking);
        setTiktokIds(data.tracking.tiktok.pixelIds.join("\n"));
      }
      setSaved("Integrações salvas. O rastreio da loja já usa estes pixels.");
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function testPixel() {
    setSaved("");
    setError("");
    const response = await fetch("/api/admin/test-pixel", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "ViewContent" }),
    });
    const data = (await response.json()) as { ok?: boolean; message?: string };
    if (data.ok) setSaved(data.message || "Teste enviado.");
    else setError(data.message || "Falha no teste.");
  }

  return (
    <form onSubmit={(event) => void onSave(event)}>
      <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">Integrações</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Pixels e APIs</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6A6A6A]">
        Cole os IDs aqui. O pixel do navegador e a API do servidor só disparam se a visita vier do anúncio daquela
        plataforma (fbclid no Meta, ttclid no TikTok, gclid no Google). Visitante orgânico não envia evento de pixel.
      </p>

      <div className="mt-8 grid gap-6">
        <Card
          title="TikTok"
          hint="Pixel + Events API. Vários IDs, um por linha. Marcar pago na geração do PIX só para aquecimento de pixel."
          enabled={form.tiktok.enabled}
          onEnabled={(enabled) => setForm((current) => ({ ...current, tiktok: { ...current.tiktok, enabled } }))}
        >
          <Field label="Pixel IDs">
            <textarea
              rows={3}
              value={tiktokIds}
              onChange={(e) => setTiktokIds(e.target.value)}
              placeholder="CXXXXXXXXXXXXXXXXXXX"
            />
          </Field>
          <Field label="Access token (Events API)">
            <input
              type="password"
              autoComplete="off"
              value={form.tiktok.accessToken}
              onChange={(e) => setForm((current) => ({ ...current, tiktok: { ...current.tiktok, accessToken: e.target.value } }))}
            />
          </Field>
          <Field label="Test event code">
            <input
              value={form.tiktok.testEventCode}
              onChange={(e) => setForm((current) => ({ ...current, tiktok: { ...current.tiktok, testEventCode: e.target.value } }))}
            />
          </Field>
          <label className="mt-4 flex items-start gap-3 text-sm text-[#B8B8B8]">
            <input
              type="checkbox"
              checked={form.tiktok.markAsPaidOnPixCreate}
              onChange={(e) =>
                setForm((current) => ({ ...current, tiktok: { ...current.tiktok, markAsPaidOnPixCreate: e.target.checked } }))
              }
              className="mt-1"
            />
            Disparar CompletePayment quando o PIX for gerado (não espere o pagamento). Deixe desligado para rastreio real.
          </label>
        </Card>

        <Card
          title="Meta (Facebook / Instagram)"
          hint="Purchase só entra quando o pedido está pago. Abrir o checkout envia InitiateCheckout, não venda."
          enabled={form.meta.enabled}
          onEnabled={(enabled) => setForm((current) => ({ ...current, meta: { ...current.meta, enabled } }))}
        >
          <Field label="Pixel ID">
            <input
              value={form.meta.pixelId}
              onChange={(e) => setForm((current) => ({ ...current, meta: { ...current.meta, pixelId: e.target.value } }))}
              placeholder="1234567890"
            />
          </Field>
          <Field label="Token CAPI">
            <input
              type="password"
              autoComplete="off"
              value={form.meta.accessToken}
              onChange={(e) => setForm((current) => ({ ...current, meta: { ...current.meta, accessToken: e.target.value } }))}
            />
          </Field>
          <Field label="Test event code">
            <input
              value={form.meta.testEventCode}
              onChange={(e) => setForm((current) => ({ ...current, meta: { ...current.meta, testEventCode: e.target.value } }))}
            />
          </Field>
        </Card>

        <Card
          title="Google"
          hint="GA4 no navegador. Measurement Protocol (api secret) confirma a compra no servidor. Ads usa o rótulo da conversão."
          enabled={form.google.enabled}
          onEnabled={(enabled) => setForm((current) => ({ ...current, google: { ...current.google, enabled } }))}
        >
          <Field label="GA4 Measurement ID">
            <input
              value={form.google.measurementId}
              onChange={(e) => setForm((current) => ({ ...current, google: { ...current.google, measurementId: e.target.value } }))}
              placeholder="G-XXXXXXXX"
            />
          </Field>
          <Field label="GA4 API secret">
            <input
              type="password"
              autoComplete="off"
              value={form.google.apiSecret}
              onChange={(e) => setForm((current) => ({ ...current, google: { ...current.google, apiSecret: e.target.value } }))}
            />
          </Field>
          <Field label="Google Ads ID">
            <input
              value={form.google.adsId}
              onChange={(e) => setForm((current) => ({ ...current, google: { ...current.google, adsId: e.target.value } }))}
              placeholder="AW-XXXXXXXX"
            />
          </Field>
          <Field label="Rótulo da conversão de compra">
            <input
              value={form.google.adsPurchaseLabel}
              onChange={(e) =>
                setForm((current) => ({ ...current, google: { ...current.google, adsPurchaseLabel: e.target.value } }))
              }
            />
          </Field>
        </Card>
      </div>

      {error ? <p className="mt-6 text-sm text-[#CC2222]">{error}</p> : null}
      {saved ? <p className="mt-6 text-sm text-emerald-400">{saved}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={loading} className="kyt-btn kyt-btn-primary">
          {loading ? "Salvando..." : "Salvar integrações"}
        </button>
        <button type="button" onClick={() => void testPixel()} className="kyt-btn kyt-btn-outline">
          Enviar evento de teste
        </button>
      </div>
    </form>
  );
}

function Card({
  title,
  hint,
  enabled,
  onEnabled,
  children,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onEnabled: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="border border-white/10 bg-[#0c0c10] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-black uppercase">{title}</h2>
          <p className="mt-1 max-w-xl text-sm text-[#6A6A6A]">{hint}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => onEnabled(e.target.checked)} />
          Ativo
        </label>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs tracking-wide text-[#6A6A6A] uppercase">{label}</span>
      <div className="[&_input]:h-11 [&_input]:w-full [&_input]:border [&_input]:border-white/15 [&_input]:bg-transparent [&_input]:px-3 [&_input]:outline-none [&_input]:focus:border-[#CC2222] [&_textarea]:w-full [&_textarea]:border [&_textarea]:border-white/15 [&_textarea]:bg-transparent [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:outline-none [&_textarea]:focus:border-[#CC2222]">
        {children}
      </div>
    </label>
  );
}
