import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { adminJson } from "@/lib/admin-fetch";
import { emptyPaymentSettings, type PaymentSettings, type PixGateway } from "@/lib/payment-types";
import { storePushcutUrls } from "@/lib/pushcut-urls";
import type { TrackingSettings } from "@/lib/tracking-types";

export const Route = createFileRoute("/admin/integracoes")({
  component: AdminIntegrationsPage,
  head: () => ({ meta: [{ title: "Integrações · Painel KYT" }] }),
});

const empty: TrackingSettings = {
  tiktok: { enabled: false, pixelIds: [], accessToken: "", testEventCode: "", markAsPaidOnPixCreate: false },
  meta: { enabled: false, pixelId: "", accessToken: "", testEventCode: "" },
  google: { enabled: false, measurementId: "", apiSecret: "", adsId: "", adsPurchaseLabel: "" },
  pushcut: { pendingUrl: "", paidUrl: "" },
};

function AdminIntegrationsPage() {
  const [form, setForm] = useState<TrackingSettings>(empty);
  const [payment, setPayment] = useState<PaymentSettings>(emptyPaymentSettings());
  const [tiktokIds, setTiktokIds] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const [testingPay, setTestingPay] = useState(false);
  const [testingPushcut, setTestingPushcut] = useState<"pending" | "paid" | "">("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"pagamento" | "pixels" | "webhook">("webhook");

  useEffect(() => {
    void Promise.all([
      adminJson<{ tracking?: TrackingSettings }>("/api/admin/tracking", {}, 8000),
      adminJson<{ payment?: PaymentSettings }>("/api/admin/payment", {}, 8000),
    ])
      .then(([trackingJson, paymentJson]) => {
        const tracking = trackingJson?.tracking;
        if (tracking) {
          setForm({ ...empty, ...tracking, pushcut: { ...empty.pushcut, ...tracking.pushcut } });
          setTiktokIds(tracking.tiktok.pixelIds.join("\n"));
          storePushcutUrls(tracking.pushcut?.pendingUrl, tracking.pushcut?.paidUrl);
        }
        const nextPay = paymentJson?.payment;
        if (nextPay)
          setPayment({
            ...emptyPaymentSettings(),
            ...nextPay,
            cardEnabled: nextPay.cardEnabled === true,
            magicpay: { ...emptyPaymentSettings().magicpay, ...nextPay.magicpay },
          });
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
        setForm({ ...empty, ...data.tracking, pushcut: { ...empty.pushcut, ...data.tracking.pushcut } });
        setTiktokIds(data.tracking.tiktok.pixelIds.join("\n"));
        storePushcutUrls(data.tracking.pushcut?.pendingUrl, data.tracking.pushcut?.paidUrl);
      } else {
        storePushcutUrls(payload.pushcut.pendingUrl, payload.pushcut.paidUrl);
      }
      setSaved("Integrações salvas. O rastreio da loja já usa estes pixels.");
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  async function persistPayment(next: PaymentSettings, okMessage?: string) {
    setSavingPay(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/admin/payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; payment?: PaymentSettings };
      if (!response.ok || !data.ok) {
        setError(data.message || "Não foi possível salvar o gateway.");
        return;
      }
      const savedPay = data.payment
        ? {
            ...emptyPaymentSettings(),
            ...data.payment,
            cardEnabled: data.payment.cardEnabled === true,
            magicpay: { ...emptyPaymentSettings().magicpay, ...data.payment.magicpay },
          }
        : next;
      setPayment(savedPay);
      setSaved(
        okMessage ||
          [
            savedPay.pixGateway === "magicpay" ? "PIX ativo na MagicPay." : "PIX ativo na Legacy.",
            savedPay.cardEnabled === false ? "Cartão desativado." : "Cartão ligado na Legacy.",
          ].join(" "),
      );
    } catch {
      setError("Falha de conexão.");
    } finally {
      setSavingPay(false);
    }
  }

  function setPixGateway(pixGateway: PixGateway) {
    const next = { ...payment, pixGateway };
    setPayment(next);
    void persistPayment(
      next,
      pixGateway === "magicpay" ? "PIX do checkout agora é MagicPay." : "PIX do checkout agora é Legacy.",
    );
  }

  async function onTestMagicPay() {
    setTestingPay(true);
    setError("");
    setSaved("Testando a MagicPay…");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/admin/test-magicpay", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setError("");
        setSaved(data.message || "MagicPay respondeu. Chaves ok.");
      } else {
        setSaved("");
        setError(data.message || "A MagicPay recusou as chaves.");
      }
    } catch (error) {
      setSaved("");
      setError(
        error instanceof Error && error.name === "AbortError"
          ? "A MagicPay não respondeu em 15s. O servidor da loja pode estar bloqueando a saída — o PIX pela MagicPay também falharia."
          : "Falha de conexão ao testar a MagicPay.",
      );
    } finally {
      window.clearTimeout(timer);
      setTestingPay(false);
    }
  }

  async function testPushcut(kind: "pending" | "paid") {
    setSaved("");
    setError("");
    setTestingPushcut(kind);
    try {
      const response = await fetch("/api/admin/test-pushcut", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (data.ok) setSaved(data.message || "Teste enviado ao Pushcut.");
      else setError(data.message || "Falha no teste do Pushcut.");
    } catch {
      setError("Falha de conexão ao testar o Pushcut.");
    } finally {
      setTestingPushcut("");
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
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Pixels, gateway e webhook</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6A6A6A]">
        Gateway de PIX, pixels da loja e aviso de venda no Pushcut. O pixel da Meta só dispara com fbclid ou cookie
        _fbc.
      </p>

      <div className="mt-6 flex flex-wrap gap-1">
        {(
          [
            { key: "webhook", label: "Webhook" },
            { key: "pagamento", label: "Pagamento" },
            { key: "pixels", label: "Pixels" },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={
              tab === item.key
                ? "bg-[#CC2222] px-4 py-2 font-display text-xs font-bold uppercase text-white"
                : "border border-white/10 px-4 py-2 font-display text-xs font-bold uppercase text-[#6A6A6A] hover:text-white"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6">
        {tab === "pagamento" ? (
        <section className="border border-white/10 bg-[#0c0c10] p-6">
          <h2 className="font-display text-2xl font-black uppercase">Pagamentos</h2>
          <p className="mt-1 max-w-xl text-sm text-[#6A6A6A]">
            As chaves da MagicPay já estão na loja, como a Legacy. Aqui você só escolhe o gateway do PIX.
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setPixGateway("legacy")}
              className={cnGateway(payment.pixGateway === "legacy")}
            >
              <span className="font-display text-sm font-black uppercase">PIX na Legacy</span>
              <span className="mt-1 block text-xs text-[#6A6A6A]">Clique e o PIX do checkout já usa ela</span>
            </button>
            <button
              type="button"
              onClick={() => setPixGateway("magicpay")}
              className={cnGateway(payment.pixGateway === "magicpay")}
            >
              <span className="font-display text-sm font-black uppercase">PIX na MagicPay</span>
              <span className="mt-1 block text-xs text-[#6A6A6A]">Clique e o PIX do checkout já usa ela</span>
            </button>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                const next = { ...payment, cardEnabled: payment.cardEnabled === false };
                setPayment(next);
                void persistPayment(
                  next,
                  next.cardEnabled === false ? "Cartão desativado no checkout." : "Cartão ligado no checkout.",
                );
              }}
              className={cnGateway(payment.cardEnabled === false)}
            >
              <span className="font-display text-sm font-black uppercase">
                {payment.cardEnabled === false ? "Cartão desativado" : "Desativar pagamentos cartão"}
              </span>
              <span className="mt-1 block text-xs text-[#6A6A6A]">
                {payment.cardEnabled === false
                  ? "Checkout só com PIX. Some 12x e cartão na loja."
                  : "Clique para esconder cartão, 12x e menções na loja."}
              </span>
            </button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" disabled={testingPay} onClick={() => void onTestMagicPay()} className="kyt-btn kyt-btn-outline">
              {testingPay ? "Testando..." : "Testar MagicPay"}
            </button>
          </div>
          {testingPay ? <p className="mt-3 text-sm text-amber-400">Falando com a MagicPay… isso leva até 15 segundos.</p> : null}
          {error ? <p className="mt-3 text-sm text-[#CC2222]">{error}</p> : null}
          {saved && tab === "pagamento" ? <p className="mt-3 text-sm text-emerald-400">{saved}</p> : null}
        </section>
        ) : null}

        {tab === "pixels" ? (
          <>
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
          </>
        ) : null}

        {tab === "webhook" ? (
          <section className="border border-white/10 bg-[#0c0c10] p-6">
            <h2 className="font-display text-2xl font-black uppercase">Webhook Pushcut</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6A6A6A]">
              Cole a URL secreta de cada notificação no app Pushcut. Nova venda dispara quando o PIX é gerado.
              Pedido pago dispara quando o dinheiro entra. Se só uma URL estiver preenchida, os dois avisos usam ela.
              O valor no aviso já é o cobrado: PIX com 10% OFF.
            </p>
            <div className="mt-6 grid gap-4">
              <Field label="URL pedido pendente">
                <input
                  value={form.pushcut.pendingUrl}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, pushcut: { ...current.pushcut, pendingUrl: e.target.value } }))
                  }
                  placeholder="https://api.pushcut.io/••••/notifications/pedido-pendente"
                />
              </Field>
              <Field label="URL pedido pago">
                <input
                  value={form.pushcut.paidUrl}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, pushcut: { ...current.pushcut, paidUrl: e.target.value } }))
                  }
                  placeholder="https://api.pushcut.io/••••/notifications/pedido-pago"
                />
              </Field>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={Boolean(testingPushcut)}
                onClick={() => void testPushcut("pending")}
                className="kyt-btn kyt-btn-outline"
              >
                {testingPushcut === "pending" ? "Enviando..." : "Testar pendente"}
              </button>
              <button
                type="button"
                disabled={Boolean(testingPushcut)}
                onClick={() => void testPushcut("paid")}
                className="kyt-btn kyt-btn-outline"
              >
                {testingPushcut === "paid" ? "Enviando..." : "Testar pago"}
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {error ? <p className="mt-6 text-sm text-[#CC2222]">{error}</p> : null}
      {saved ? <p className="mt-6 text-sm text-emerald-400">{saved}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="submit" disabled={loading} className="kyt-btn kyt-btn-primary">
          {loading ? "Salvando..." : "Salvar integrações"}
        </button>
        {tab === "pixels" ? (
          <button type="button" onClick={() => void testPixel()} className="kyt-btn kyt-btn-outline">
            Enviar evento de teste
          </button>
        ) : null}
      </div>
    </form>
  );
}

function cnGateway(active: boolean) {
  return active
    ? "border border-[#CC2222] bg-[#CC2222]/10 px-4 py-4 text-left text-white"
    : "border border-white/15 px-4 py-4 text-left text-[#F0F0F0] hover:border-white/40";
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
