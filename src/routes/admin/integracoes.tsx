import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { adminJson } from "@/lib/admin-fetch";
import { cn } from "@/lib/utils";
import {
  emptyPaymentSettings,
  PIX_GATEWAY_LABEL,
  PIX_GATEWAYS,
  type PixGateway,
  type PublicPaymentSettings,
} from "@/lib/payment-types";
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
  utmify: { apiToken: "" },
};

function AdminIntegrationsPage() {
  const [form, setForm] = useState<TrackingSettings>(empty);
  const [payment, setPayment] = useState<PublicPaymentSettings>(emptyPublicPayment());
  const [keyInput, setKeyInput] = useState<Record<"pixgate" | "sagacepay", string>>({ pixgate: "", sagacepay: "" });
  const [testingGateway, setTestingGateway] = useState<PixGateway | "">("");
  const [tiktokIds, setTiktokIds] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPay, setSavingPay] = useState(false);
  const [testingPushcut, setTestingPushcut] = useState<"pending" | "paid" | "">("");
  const [testingUtmify, setTestingUtmify] = useState<"paid" | "waiting_payment" | "">("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"pagamento" | "pixels" | "webhook">("webhook");

  useEffect(() => {
    void Promise.all([
      adminJson<{ tracking?: TrackingSettings }>("/api/admin/tracking", {}, 8000),
      adminJson<{ payment?: PublicPaymentSettings }>("/api/admin/payment", {}, 8000),
    ])
      .then(([trackingJson, paymentJson]) => {
        const tracking = trackingJson?.tracking;
        if (tracking) {
          setForm({ ...empty, ...tracking, pushcut: { ...empty.pushcut, ...tracking.pushcut }, utmify: { ...empty.utmify, ...tracking.utmify } });
          setTiktokIds(tracking.tiktok.pixelIds.join("\n"));
          storePushcutUrls(tracking.pushcut?.pendingUrl, tracking.pushcut?.paidUrl);
        }
        const nextPay = paymentJson?.payment;
        if (nextPay) setPayment(normalizePublicPayment(nextPay));
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
        setForm({ ...empty, ...data.tracking, pushcut: { ...empty.pushcut, ...data.tracking.pushcut }, utmify: { ...empty.utmify, ...data.tracking.utmify } });
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

  async function persistPayment(
    next: PublicPaymentSettings,
    okMessage?: string,
    keys?: Partial<Record<"pixgate" | "sagacepay", string>>,
  ) {
    const body: Record<string, unknown> = {
      ...next,
      ...(keys?.pixgate ? { pixgate: { apiKey: keys.pixgate } } : {}),
      ...(keys?.sagacepay ? { sagacepay: { apiKey: keys.sagacepay } } : {}),
    };
    setSavingPay(true);
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/admin/payment", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; payment?: PublicPaymentSettings };
      if (!response.ok || !data.ok) {
        setError(data.message || "Não foi possível salvar o gateway.");
        return;
      }
      const savedPay = data.payment ? normalizePublicPayment(data.payment) : normalizePublicPayment(next);
      setPayment(savedPay);
      setSaved(
        okMessage ||
          [
            `PIX ativo na ${PIX_GATEWAY_LABEL[savedPay.pixGateway]}.`,
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
    if ((pixGateway === "pixgate" || pixGateway === "sagacepay") && !payment[pixGateway].configured) {
      setSaved("");
      setError(`Cadastre a chave da ${PIX_GATEWAY_LABEL[pixGateway]} antes de ativá-la.`);
      return;
    }
    const next = { ...payment, pixGateway };
    setPayment(next);
    void persistPayment(next, `PIX do checkout agora é ${PIX_GATEWAY_LABEL[pixGateway]}.`);
  }

  async function saveGatewayKey(gateway: "pixgate" | "sagacepay") {
    const apiKey = keyInput[gateway].trim();
    if (apiKey.length < 10) {
      setError(`Cole a chave completa da ${PIX_GATEWAY_LABEL[gateway]}.`);
      return;
    }
    await persistPayment(payment, `Chave da ${PIX_GATEWAY_LABEL[gateway]} salva.`, { [gateway]: apiKey });
    setKeyInput((current) => ({ ...current, [gateway]: "" }));
  }

  async function removeGatewayKey(gateway: "pixgate" | "sagacepay") {
    setError("");
    setSaved("");
    try {
      const response = await fetch("/api/admin/gateway-key", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; payment?: PublicPaymentSettings };
      if (!response.ok || !data.ok) {
        setError(data.message || "Não foi possível apagar a chave.");
        return;
      }
      if (data.payment) setPayment(normalizePublicPayment(data.payment));
      setSaved(`Chave da ${PIX_GATEWAY_LABEL[gateway]} apagada do painel.`);
    } catch {
      setError("Falha de conexão.");
    }
  }

  async function testGateway(gateway: PixGateway) {
    setTestingGateway(gateway);
    setError("");
    setSaved(`Testando a ${PIX_GATEWAY_LABEL[gateway]}…`);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/admin/test-gateway", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway }),
        signal: controller.signal,
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (data.ok) {
        setError("");
        setSaved(data.message || `${PIX_GATEWAY_LABEL[gateway]} respondeu. Chave ok.`);
      } else {
        setSaved("");
        setError(data.message || `A ${PIX_GATEWAY_LABEL[gateway]} recusou a chave.`);
      }
    } catch (error) {
      setSaved("");
      setError(
        error instanceof Error && error.name === "AbortError"
          ? `A ${PIX_GATEWAY_LABEL[gateway]} não respondeu em 15s.`
          : `Falha de conexão ao testar a ${PIX_GATEWAY_LABEL[gateway]}.`,
      );
    } finally {
      window.clearTimeout(timer);
      setTestingGateway("");
    }
  }

  async function testUtmify(status: "paid" | "waiting_payment") {
    setSaved("");
    setError("");
    setTestingUtmify(status);
    try {
      const response = await fetch("/api/admin/test-utmify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Testa o token que está no campo agora (mesmo antes de salvar).
        body: JSON.stringify({ status, token: form.utmify.apiToken.trim() }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (data.ok) setSaved(data.message || "Teste enviado à UTMify.");
      else setError(data.message || "Falha no teste da UTMify.");
    } catch {
      setError("Falha de conexão ao testar a UTMify.");
    } finally {
      setTestingUtmify("");
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
              Escolha o gateway que gera o PIX do checkout. Legacy e MagicPay já têm as chaves na loja; PixGate e
              SagacePay usam a chave cadastrada abaixo (ou a variável de ambiente). Pedidos já gerados continuam no
              gateway em que nasceram.
            </p>

            <Diagnostico />

            {payment.pixGatewayForced ? (
              <p className="mt-4 border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                O gateway está definido no Secret <b>PIX_GATEWAY</b> do Lovable Cloud ({PIX_GATEWAY_LABEL[payment.pixGateway]}). Para
                trocar, edite o Secret; os botões abaixo ficam bloqueados.
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {PIX_GATEWAYS.map((gateway) => {
                const configured = gateway === "pixgate" || gateway === "sagacepay" ? payment[gateway].configured : true;
                return (
                  <button
                    key={gateway}
                    type="button"
                    disabled={payment.pixGatewayForced === true}
                    onClick={() => setPixGateway(gateway)}
                    className={cn(cnGateway(payment.pixGateway === gateway), payment.pixGatewayForced && payment.pixGateway !== gateway && "opacity-40")}
                  >
                    <span className="font-display text-sm font-black uppercase">
                      PIX na {PIX_GATEWAY_LABEL[gateway]}
                      {payment.pixGateway === gateway ? " · em uso" : ""}
                    </span>
                    <span className="mt-1 block text-xs text-[#6A6A6A]">
                      {configured ? "Clique e o PIX do checkout já usa ela" : "Sem chave cadastrada"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {(["pixgate", "sagacepay"] as const).map((gateway) => (
                <div key={gateway} className="border border-white/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-lg font-black uppercase">{PIX_GATEWAY_LABEL[gateway]}</h3>
                    <span className="text-xs text-[#6A6A6A]">
                      {payment[gateway].configured
                        ? `Chave em uso: ${payment[gateway].apiKeyMasked || "cadastrada"}`
                        : "Sem chave"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6A6A6A]">
                    {gateway === "pixgate"
                      ? "Apikey do painel da PixGate (app.pixgateip.com). O postback é enviado automaticamente em cada cobrança."
                      : "Chave sk_live_… do painel da SagacePay. O postback é enviado automaticamente em cada cobrança."}
                  </p>
                  <Field label="Chave de API">
                    <input
                      type="password"
                      autoComplete="off"
                      value={keyInput[gateway]}
                      onChange={(e) => setKeyInput((current) => ({ ...current, [gateway]: e.target.value }))}
                      placeholder={payment[gateway].apiKeyMasked || "Cole a chave aqui"}
                    />
                  </Field>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={savingPay || keyInput[gateway].trim().length < 10}
                      onClick={() => void saveGatewayKey(gateway)}
                      className="kyt-btn kyt-btn-primary"
                    >
                      Salvar chave
                    </button>
                    <button
                      type="button"
                      disabled={testingGateway !== "" || !payment[gateway].configured}
                      onClick={() => void testGateway(gateway)}
                      className="kyt-btn kyt-btn-outline"
                    >
                      {testingGateway === gateway ? "Testando..." : "Testar"}
                    </button>
                    {payment[gateway].apiKeyMasked && payment[gateway].apiKeyMasked !== "Secret do Lovable Cloud" ? (
                      <button type="button" onClick={() => void removeGatewayKey(gateway)} className="kyt-btn kyt-btn-outline">
                        Apagar chave do painel
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
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
              <button
                type="button"
                disabled={testingGateway !== ""}
                onClick={() => void testGateway("magicpay")}
                className="kyt-btn kyt-btn-outline"
              >
                {testingGateway === "magicpay" ? "Testando..." : "Testar MagicPay"}
              </button>
            </div>
            {testingGateway ? (
              <p className="mt-3 text-sm text-amber-400">
                Falando com a {PIX_GATEWAY_LABEL[testingGateway]}… isso leva até 15 segundos.
              </p>
            ) : null}
            {error ? <p className="mt-3 text-sm text-[#CC2222]">{error}</p> : null}
            {saved && tab === "pagamento" ? <p className="mt-3 text-sm text-emerald-400">{saved}</p> : null}
          </section>
        ) : null}

        {tab === "pixels" ? (
          <>
        <Card
          title="TikTok"
          hint="Pixel + Events API. Vários IDs, um por linha. Compra (CompletePayment) só é enviada quando o PIX é pago."
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
          <p className="text-xs text-[#6A6A6A] md:col-span-2">
              Compra no TikTok, Meta, Google e UTMify só é marcada quando o PIX é pago. A antiga opção de marcar pago na
              geração do PIX foi desativada.
            </p>
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
              O valor no aviso já é o cobrado no PIX.
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

        {tab === "webhook" ? (
          <section className="border border-white/10 bg-[#0c0c10] p-6">
            <h2 className="font-display text-2xl font-black uppercase">UTMify</h2>
            <p className="mt-1 max-w-xl text-sm text-[#6A6A6A]">
              Cada PIX gerado (pendente) e cada pagamento aprovado é enviado à UTMify com as UTMs do cliente (src, sck,
              utm_source, utm_campaign, utm_medium, utm_content, utm_term), como na Aidex. Cole o token da API de
              credenciais e clique em Salvar integrações.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Token da API (x-api-token)">
                <input
                  type="password"
                  autoComplete="off"
                  value={form.utmify.apiToken}
                  onChange={(e) => setForm((current) => ({ ...current, utmify: { apiToken: e.target.value } }))}
                  placeholder="Cole o token da UTMify"
                />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={testingUtmify !== "" || !form.utmify.apiToken.trim()}
                onClick={() => void testUtmify("paid")}
                className="kyt-btn kyt-btn-outline"
              >
                {testingUtmify === "paid" ? "Testando..." : "Testar conexão (pago)"}
              </button>
              <button
                type="button"
                disabled={testingUtmify !== "" || !form.utmify.apiToken.trim()}
                onClick={() => void testUtmify("waiting_payment")}
                className="kyt-btn kyt-btn-outline"
              >
                {testingUtmify === "waiting_payment" ? "Testando..." : "Testar conexão (pendente)"}
              </button>
            </div>
            <p className="mt-3 text-xs text-[#6A6A6A]">
              {form.utmify.apiToken.trim()
                ? "O teste usa o token que está no campo. Para trocar o token, cole o novo, teste e clique em Salvar integrações."
                : "Sem token: nada é enviado à UTMify."}
            </p>
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

function emptyPublicPayment(): PublicPaymentSettings {
  const base = emptyPaymentSettings();
  return {
    pixGateway: base.pixGateway,
    pixGatewayChosen: false,
    cardEnabled: false,
    cardEnabledChosen: false,
    magicpay: { apiUrl: base.magicpay.apiUrl, configured: true, publicKeyMasked: "" },
    pixgate: { configured: false, apiKeyMasked: "" },
    sagacepay: { configured: false, apiKeyMasked: "" },
  };
}

function normalizePublicPayment(raw: Partial<PublicPaymentSettings>): PublicPaymentSettings {
  const base = emptyPublicPayment();
  return {
    ...base,
    ...raw,
    cardEnabled: raw.cardEnabled === true,
    magicpay: { ...base.magicpay, ...(raw.magicpay ?? {}) },
    pixgate: { ...base.pixgate, ...(raw.pixgate ?? {}) },
    sagacepay: { ...base.sagacepay, ...(raw.sagacepay ?? {}) },
  };
}

type DiagnosticoData = {
  versao?: string;
  gatewayEscolhido?: string;
  escolhidoNoPainel?: boolean;
  travadoPorSecret?: boolean;
  proximoPixVaiPara?: string;
  pixgate?: { temChave: boolean; origem: string | null };
  secretsVistosPeloServidor?: Record<string, boolean>;
  armazenamentoCompartilhado?: boolean;
};

/** Mostra o que ESTE servidor faria no próximo PIX (sem expor chaves). */
function Diagnostico() {
  const [data, setData] = useState<DiagnosticoData | null>(null);
  const [loading, setLoading] = useState(false);
  async function load() {
    setLoading(true);
    setData(await adminJson<DiagnosticoData>("/api/admin/diagnostico", {}, 10000));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  const magic = data?.proximoPixVaiPara?.startsWith("magicpay");
  return (
    <div className={cn("mt-4 border px-4 py-3 text-sm", magic ? "border-amber-400/40 bg-amber-400/10" : "border-emerald-500/30 bg-emerald-500/5")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-xs font-bold tracking-[0.14em] uppercase">Diagnóstico deste servidor</p>
        <button type="button" onClick={() => void load()} className="text-xs text-[#6A6A6A] underline hover:text-white">
          {loading ? "Atualizando..." : "Atualizar"}
        </button>
      </div>
      {data ? (
        <ul className="mt-2 space-y-1 text-xs text-[#C8C8C8]">
          <li>
            Próximo PIX vai para: <b className="text-white">{data.proximoPixVaiPara}</b>
          </li>
          <li>
            Gateway escolhido: {data.gatewayEscolhido} {data.travadoPorSecret ? "(travado pelo Secret PIX_GATEWAY)" : data.escolhidoNoPainel ? "(salvo no painel)" : "(padrão da loja)"}
          </li>
          <li>
            Chave da PixGate: {data.pixgate?.temChave ? `sim (${data.pixgate.origem === "env" ? "Secret" : "painel"})` : "NÃO encontrada neste servidor"}
          </li>
          <li>
            Secrets lidos:{" "}
            {Object.entries(data.secretsVistosPeloServidor ?? {})
              .map(([name, ok]) => `${name} ${ok ? "✓" : "✗"}`)
              .join(" · ")}
          </li>
          <li>Versão publicada: {data.versao}</li>
        </ul>
      ) : (
        <p className="mt-2 text-xs text-[#6A6A6A]">{loading ? "Carregando..." : "Sem resposta. Se não aparecer, a versão publicada é antiga."}</p>
      )}
    </div>
  );
}
