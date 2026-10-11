import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { MercadoFullBadge } from "@/components/checkout/MercadoFullBadge";
import { OrderBump } from "@/components/checkout/OrderBump";
import { Field, PixIcon, PrimaryButton, Radio, StepCard, StepHead } from "@/components/checkout/parts";
import { SummaryDesktop, SummaryMobile } from "@/components/checkout/Summary";
import {
  catalogPriceFor,
  clampInstallments,
  INSTALLMENT_FEE,
  INSTALLMENTS,
  installmentFeeCents,
  pixPrice,
} from "@/data/catalog";
import { getOffer, offerCartItem, ORDER_BUMPS, type Offer } from "@/data/offers";
import { useCart, type CheckoutPayload, type PaymentStatus } from "@/lib/cart";
import { formatBRL, formatCep, formatCpf, formatPhone, onlyDigits } from "@/lib/format";
import { asRecord, fetchLegacyPublicConfig, loadLegacyPay, newReferenceId, type JsonRecord } from "@/lib/legacy-pay";
import { createPayin, type PayinResponse } from "@/lib/payin-client";
import { useCardEnabled, usePixGateway } from "@/lib/payment-options";
import { isPixGateway, STOREFRONT_ALLOWS_CARD } from "@/lib/payment-types";
import { getAttribution, newEventId, pingLive, trackEvent } from "@/lib/pixel-client";
import { SHIPPING_OPTIONS, shippingPrice, type ShippingMethod } from "@/lib/shipping";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout seguro | KYT Capacetes Brasil" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

type Step = 1 | 2 | 3;

type FormState = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  payment: "pix" | "card";
  shipping: ShippingMethod;
  installments: number;
  cardName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  cpf: "",
  cep: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  payment: "pix",
  shipping: "gratis",
  installments: 1,
  cardName: "",
  cardNumber: "",
  cardExpiry: "",
  cardCvv: "",
};

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

function toCents(value: number) {
  return Math.max(1, Math.round(value * 100));
}

function chargedCents(items: { productId: string; price: number; quantity: number }[], method: "PIX" | "CREDIT_CARD") {
  let amount = 0;
  for (const item of items) {
    const unit = catalogPriceFor(item.productId, item.price);
    const charged = method === "PIX" ? pixPrice(unit) : unit;
    amount += toCents(charged) * item.quantity;
  }
  return amount;
}

function parseExpiry(value: string): { month: string; year: string } | null {
  const digits = onlyDigits(value);
  if (digits.length !== 4) return null;
  const month = digits.slice(0, 2);
  const monthNum = Number(month);
  if (monthNum < 1 || monthNum > 12) return null;
  return { month, year: `20${digits.slice(2)}` };
}

function sdkPhone(phone: string) {
  const digits = onlyDigits(phone);
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export function mapPaymentStatus(status: unknown): PaymentStatus {
  const value = String(status ?? "").toLowerCase().trim();
  if (["paid", "pago", "aprovado", "confirmado", "confirmed", "liquidado", "completed", "complete", "success", "succeeded", "settled", "received", "done"].includes(value)) {
    return "paid";
  }
  if (["failed", "falha", "cancelled", "canceled", "expired", "expirado", "refunded", "estornado", "refused", "recusado"].includes(value)) {
    return "failed";
  }
  return "pending";
}

function paymentErrorMessage(error: unknown): string {
  const rec = error && typeof error === "object" ? (error as { code?: string; message?: string }) : {};
  if (rec.code === "THREEDS_EXPIRED") return "O tempo para confirmar expirou. Tente novamente.";
  if (rec.code === "THREEDS_FAILED") return "Não foi possível autenticar o cartão. Tente outro cartão.";
  if (rec.code === "THREEDS_SDK_UNAVAILABLE") return "Não foi possível carregar a autenticação do cartão. Desative bloqueadores e tente de novo.";
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  if (error instanceof Error && error.message) return error.message;
  return "Falha no pagamento. Tente novamente.";
}

function CheckoutPage() {
  const { items, placeOrder, hydrated, closeCart, updateQty, removeItem } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [bumpIds, setBumpIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cardEnabled = STOREFRONT_ALLOWS_CARD && useCardEnabled();
  const pixGatewayHint = usePixGateway();
  const checkoutTracked = useRef(false);

  const bumps = useMemo(() => bumpIds.map((id) => getOffer(id)).filter((offer): offer is Offer => Boolean(offer)), [bumpIds]);
  const bumpsTotal = bumps.reduce((sum, offer) => sum + offer.price, 0);
  const listItems = useMemo(() => chargedCents(items, "CREDIT_CARD") / 100, [items]);
  const pixItems = useMemo(() => chargedCents(items, "PIX") / 100, [items]);
  const freight = shippingPrice(form.shipping);
  const freightCents = Math.max(0, Math.round(freight * 100));
  const bumpsCents = Math.round(bumpsTotal * 100);
  const cardBaseCents = chargedCents(items, "CREDIT_CARD") + bumpsCents + freightCents;
  const feeCents = installmentFeeCents(cardBaseCents, form.installments);
  const cardTotal = (cardBaseCents + feeCents) / 100;
  const pixTotal = Math.round((pixItems + bumpsTotal + freight) * 100) / 100;
  const pixDiscount = Math.max(0, Math.round((listItems - pixItems) * 100) / 100);
  const payWithPix = !cardEnabled || form.payment === "pix";
  const payable = payWithPix ? pixTotal : cardTotal;

  useEffect(() => {
    closeCart();
  }, [closeCart]);

  useEffect(() => {
    if (!cardEnabled) setForm((current) => ({ ...current, payment: "pix" }));
  }, [cardEnabled]);

  useEffect(() => {
    if (!hydrated || items.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackEvent({
      event: "InitiateCheckout",
      eventId: newEventId("ic"),
      value: pixTotal,
      contents: items.map((item) => ({ id: item.productId, name: item.name, quantity: item.quantity, price: item.price })),
    });
  }, [hydrated, items, pixTotal]);

  // Painel "Ao vivo" / carrinhos abandonados: nome, e-mail e telefone conforme o cliente digita.
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const timer = window.setTimeout(() => {
      pingLive({
        event: "heartbeat",
        path: "/checkout",
        customer: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hydrated, items.length, form.name, form.email, form.phone, step]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  // Busca de endereço pelo CEP (ViaCEP).
  useEffect(() => {
    const digits = onlyDigits(form.cep);
    if (digits.length !== 8) return;
    let alive = true;
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((response) => response.json())
      .then((data: { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }) => {
        if (!alive || data.erro) return;
        setForm((current) => ({
          ...current,
          street: current.street || (data.logradouro ?? ""),
          neighborhood: current.neighborhood || (data.bairro ?? ""),
          city: data.localidade ?? current.city,
          state: data.uf ?? current.state,
        }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [form.cep]);

  const idValid =
    form.name.trim().split(/\s+/).length >= 2 && emailOk(form.email) && onlyDigits(form.cpf).length === 11 && onlyDigits(form.phone).length >= 10;
  const addrValid =
    onlyDigits(form.cep).length === 8 && Boolean(form.street.trim()) && Boolean(form.number.trim()) && Boolean(form.neighborhood.trim()) && Boolean(form.city.trim()) && form.state.length === 2;

  function toggleBump(id: string, on: boolean) {
    setBumpIds((current) => (on ? [...current.filter((entry) => entry !== id), id] : current.filter((entry) => entry !== id)));
  }

  function buildCustomer(): CheckoutPayload {
    return {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone,
      cpf: form.cpf,
      cep: form.cep,
      street: form.street.trim(),
      number: form.number.trim(),
      complement: form.complement.trim(),
      neighborhood: form.neighborhood.trim(),
      city: form.city.trim(),
      state: form.state,
      payment: payWithPix ? "pix" : "card",
    };
  }

  function orderPayload(referenceId: string, method: "PIX" | "CREDIT_CARD"): JsonRecord {
    return {
      paymentMethod: method,
      referenceId,
      comprador: {
        nome: form.name.trim(),
        email: form.email.trim(),
        telefone: onlyDigits(form.phone),
        cpf: onlyDigits(form.cpf),
      },
      entrega: {
        endereco: form.street.trim(),
        numero: form.number.trim(),
        complemento: form.complement.trim(),
        bairro: form.neighborhood.trim(),
        cidade: form.city.trim(),
        estado: form.state,
        cep: onlyDigits(form.cep),
      },
      carrinho: items.map((item) => ({
        productId: item.productId,
        titulo: `${item.name} ${item.color} ${item.size}`.slice(0, 120),
        quantidade: item.quantity,
        preco: catalogPriceFor(item.productId, item.price),
        price: catalogPriceFor(item.productId, item.price),
      })),
      extras: bumps.map((offer) => ({ id: offer.id })),
      shippingCents: freightCents,
      shippingMethod: form.shipping,
      ...(method === "CREDIT_CARD" ? { installments: form.installments } : {}),
    };
  }

  async function payWithCard(referenceId: string): Promise<{ result: PayinResponse; last4: string }> {
    const expiry = parseExpiry(form.cardExpiry);
    if (!expiry) throw new Error("Validade do cartão inválida.");
    const number = onlyDigits(form.cardNumber);
    const amount = cardBaseCents + feeCents;
    const sdkCustomer = {
      name: form.name.trim(),
      document: onlyDigits(form.cpf),
      email: form.email.trim(),
      phone: sdkPhone(form.phone),
      address: { street: form.street.trim(), number: form.number.trim(), zipCode: onlyDigits(form.cep), city: form.city.trim(), state: form.state },
    };
    const cardInput = {
      holderName: form.cardName.trim(),
      number,
      expirationMonth: expiry.month,
      expirationYear: expiry.year,
      cvv: form.cardCvv,
      installments: form.installments,
    };
    const cfg = await fetchLegacyPublicConfig();
    const LegacyPay = await loadLegacyPay();
    const client = LegacyPay.init(cfg);
    const prepared = asRecord(
      await client.prepareCardPayment({ amount, installments: form.installments, referenceId, card: cardInput, customer: sdkCustomer }),
    );
    const payinCard = asRecord(prepared["payinCard"]);
    const token = String(payinCard["token"] ?? prepared["token"] ?? "").trim();
    if (!token.startsWith("cvt_")) throw new Error("Não foi possível tokenizar o cartão. Tente outro cartão.");
    const payload = orderPayload(referenceId, "CREDIT_CARD");
    const card: JsonRecord = { token, installments: form.installments };
    if (payinCard["threeDSecure"] && typeof payinCard["threeDSecure"] === "object") card["threeDSecure"] = payinCard["threeDSecure"];
    payload["card"] = card;
    const antifraud = asRecord(prepared["antifraud"]);
    const sessionId = String(antifraud["sessionId"] ?? "").trim();
    if (sessionId) payload["antifraud"] = { sessionId };
    const result = await createPayin(payload);
    if (result.threeDSecurePending) {
      await client.handlePendingThreeDS(result, {
        card: { ...cardInput, expiry: form.cardExpiry },
        customer: sdkCustomer,
        amount: Number(result.amount ?? amount),
        installments: form.installments,
      });
    }
    const last4 = String(asRecord(prepared["card"])["last4"] ?? number.slice(-4));
    return { result, last4 };
  }

  function submitId(event: FormEvent) {
    event.preventDefault();
    if (!idValid) return;
    setStep(addrValid ? 3 : 2);
  }

  function submitAddr(event: FormEvent) {
    event.preventDefault();
    if (!addrValid) return;
    setStep(3);
  }

  async function finish() {
    setError("");
    if (items.length === 0) {
      setError("Seu carrinho está vazio.");
      return;
    }
    if (!idValid) {
      setStep(1);
      return;
    }
    if (!addrValid) {
      setStep(2);
      return;
    }
    if (!payWithPix && (onlyDigits(form.cardNumber).length < 16 || form.cardCvv.length < 3 || !form.cardName || !parseExpiry(form.cardExpiry))) {
      setError("Preencha os dados do cartão.");
      return;
    }

    setLoading(true);
    const referenceId = newReferenceId();
    const customer = buildCustomer();
    const bumpItems = bumps.map(offerCartItem);
    const contents = [...items, ...bumpItems].map((item) => ({ id: item.productId, name: item.name, quantity: item.quantity, price: item.price }));
    const customerForTrack = { name: customer.name, email: customer.email, phone: customer.phone, cpf: customer.cpf, city: customer.city, state: customer.state, cep: customer.cep };
    try {
      trackEvent({ event: "AddPaymentInfo", eventId: newEventId("pay"), value: payable, contents, customer: customerForTrack });
      let result: PayinResponse;
      let total = pixTotal;
      let discount = pixDiscount;
      if (!payWithPix) {
        const paid = await payWithCard(referenceId);
        result = paid.result;
        customer.cardName = form.cardName.trim();
        customer.cardLast4 = paid.last4;
        total = cardTotal;
        discount = 0;
      } else {
        result = await createPayin(orderPayload(referenceId, "PIX"));
      }
      const pixCode = String(result.pixCode ?? result["copy_and_paste"] ?? result["qr_code"] ?? "").trim();
      const pixImage = String(result.pixImage ?? result["qr_code_image_url"] ?? "").trim();
      if (payWithPix && !pixCode) throw new Error("Não foi possível gerar o PIX. Tente novamente.");
      const eventId = `pur_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const order = placeOrder(
        customer,
        {
          total,
          discount,
          shipping: freight,
          shippingMethod: form.shipping,
          paymentStatus: mapPaymentStatus(result.status),
          eventId,
          ...(result.transactionId ? { transactionId: String(result.transactionId) } : {}),
          ...(result.referenceId ? { referenceId: String(result.referenceId) } : { referenceId }),
          ...(pixCode ? { pix: { code: pixCode, image: pixImage } } : {}),
          ...(payWithPix ? {} : { installments: form.installments }),
          paymentGateway: payWithPix ? (isPixGateway(result.paymentGateway) ? result.paymentGateway : pixGatewayHint) : "legacy",
        },
        bumpItems,
      );
      const liveStatus = order.paymentStatus === "paid" ? "paid" : order.paymentStatus === "failed" ? "failed" : "pending";
      pingLive({
        event: order.paymentStatus === "paid" ? "Purchase" : order.paymentStatus === "failed" ? "AddPaymentInfo" : "CompletePayment",
        path: order.paymentStatus === "paid" ? `/obrigado/${order.id}` : `/pedido/${order.id}`,
        orderId: order.id,
        paymentStatus: liveStatus,
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
        cartItems: order.items,
      });
      try {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...order, eventId, attribution: getAttribution(), userAgent: navigator.userAgent }),
          keepalive: true,
        });
      } catch {
        // o pedido local já existe; o painel tenta de novo no status/webhook
      }
      trackEvent({
        event: order.paymentStatus === "paid" ? "Purchase" : "CompletePayment",
        eventId,
        value: order.total,
        orderId: order.id,
        contents,
        customer: customerForTrack,
      });
      if (order.paymentStatus === "paid") await navigate({ to: "/obrigado/$id", params: { id: order.id }, replace: true });
      else await navigate({ to: "/pedido/$id", params: { id: order.id }, replace: true });
    } catch (err) {
      const message = paymentErrorMessage(err);
      console.error("[checkout] pagamento", (err as { code?: string })?.code, message);
      setError(message);
      if (payWithPix) {
        const failedId = `KYT-${Date.now().toString(36).toUpperCase()}`;
        const cartSnapshot = [...items, ...bumpItems];
        pingLive({
          event: "AddPaymentInfo",
          path: "/checkout",
          orderId: failedId,
          paymentStatus: "failed",
          customer: { name: customer.name, email: customer.email, phone: customer.phone },
          cartItems: cartSnapshot,
        });
        void fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: failedId,
            createdAt: new Date().toISOString(),
            items: cartSnapshot,
            customer,
            subtotal: listItems + bumpsTotal,
            shipping: freight,
            shippingMethod: form.shipping,
            total: pixTotal,
            discount: pixDiscount,
            paymentStatus: "failed",
            errorMessage: message,
            referenceId,
            eventId: newEventId("err"),
            attribution: getAttribution(),
            userAgent: navigator.userAgent,
            paymentGateway: pixGatewayHint,
          }),
          keepalive: true,
        }).catch(() => undefined);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <section className="py-20 text-center">
        <p className="text-[#6A6A6A]">Carregando pedido...</p>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="py-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Seu carrinho está vazio</h1>
        <p className="mt-4 text-[#6A6A6A]">Adicione um capacete para continuar.</p>
        <Link to="/produtos" className="kyt-btn kyt-btn-primary mt-6">
          Ver capacetes
        </Link>
      </section>
    );
  }

  const summary = {
    items,
    bumps,
    shipping: form.shipping,
    freight,
    listTotal: listItems + bumpsTotal,
    pixDiscount: payWithPix ? pixDiscount : 0,
    total: payable,
    locked: loading,
    onQty: updateQty,
    onRemove: removeItem,
  };

  const idCard =
    step === 1 ? (
      <StepCard>
        <StepHead title="Identificação" step="1 de 3" sub="Preencha seus dados para o envio do pedido." />
        <form onSubmit={submitId} className="mt-5 space-y-4">
          <Field
            label="Nome completo"
            autoComplete="name"
            required
            value={form.name}
            ok={form.name.trim().split(/\s+/).length >= 2}
            onChange={(e) => set("name", e.target.value)}
          />
          <Field label="E-mail" type="email" autoComplete="email" required value={form.email} ok={emailOk(form.email)} onChange={(e) => set("email", e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CPF" inputMode="numeric" required value={form.cpf} ok={onlyDigits(form.cpf).length === 11} onChange={(e) => set("cpf", formatCpf(e.target.value))} />
            <Field
              label="Celular / WhatsApp"
              inputMode="tel"
              autoComplete="tel"
              required
              value={form.phone}
              ok={onlyDigits(form.phone).length >= 10}
              onChange={(e) => set("phone", formatPhone(e.target.value))}
            />
          </div>
          <PrimaryButton type="submit" disabled={!idValid}>
            Ir para entrega
          </PrimaryButton>
        </form>
      </StepCard>
    ) : (
      <StepCard done>
        <StepHead title="Identificação" onEdit={() => setStep(1)} />
        <p className="mt-3 text-sm font-semibold">{form.name}</p>
        <p className="mt-1 text-sm text-[#A0A0A0]">{form.email}</p>
        <p className="mt-1 text-sm text-[#A0A0A0]">{form.phone}</p>
      </StepCard>
    );

  const addrCard =
    step === 2 ? (
      <StepCard>
        <StepHead title="Entrega" step="2 de 3" sub="Informe o endereço de entrega." />
        <form onSubmit={submitAddr} className="mt-5 space-y-4">
          <div className="flex items-end gap-4">
            <Field label="CEP" wrap="w-2/3" inputMode="numeric" required value={form.cep} ok={onlyDigits(form.cep).length === 8} onChange={(e) => set("cep", formatCep(e.target.value))} />
            {form.state ? (
              <span className="pb-3.5 text-xs text-[#A0A0A0]">
                {form.city}/{form.state}
              </span>
            ) : null}
          </div>
          <Field label="Endereço" required value={form.street} ok={Boolean(form.street.trim())} onChange={(e) => set("street", e.target.value)} />
          <div className="flex gap-3">
            <Field label="Nº" wrap="w-1/4" required value={form.number} ok={Boolean(form.number.trim())} onChange={(e) => set("number", e.target.value)} />
            <Field label="Bairro" wrap="flex-1" required value={form.neighborhood} ok={Boolean(form.neighborhood.trim())} onChange={(e) => set("neighborhood", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_80px]">
            <Field
              label={
                <>
                  Complemento <span className="text-[#6A6A6A] normal-case">(opcional)</span>
                </>
              }
              value={form.complement}
              onChange={(e) => set("complement", e.target.value)}
            />
            <Field label="Cidade" required value={form.city} ok={Boolean(form.city.trim())} onChange={(e) => set("city", e.target.value)} />
            <Field label="UF" required maxLength={2} value={form.state} ok={form.state.length === 2} onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))} />
          </div>

          <p className="pt-2 font-display text-sm font-bold tracking-[0.14em] uppercase">Escolha o frete</p>
          <div className="grid gap-2">
            {SHIPPING_OPTIONS.map((option) => {
              const selected = form.shipping === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => set("shipping", option.id)}
                  className={cn(
                    "flex w-full items-center gap-4 border px-4 py-4 text-left",
                    selected ? "border-[#CC2222] bg-[#CC2222]/10" : "border-white/15 hover:border-white/40",
                  )}
                >
                  <Radio on={selected} />
                  <span className="flex-1">
                    {option.id === "full" ? <MercadoFullBadge className="h-6" /> : <span className="block font-display text-sm font-bold uppercase">{option.title}</span>}
                    <span className="mt-1 block text-xs text-[#6A6A6A]">{option.eta}</span>
                  </span>
                  <span className={cn("font-display text-sm font-black", option.price === 0 && "text-emerald-400")}>
                    {option.price > 0 ? formatBRL(option.price) : "Grátis"}
                  </span>
                </button>
              );
            })}
          </div>
          <PrimaryButton type="submit" disabled={!addrValid}>
            Ir para pagamento
          </PrimaryButton>
        </form>
      </StepCard>
    ) : step === 3 ? (
      <StepCard done>
        <StepHead title="Enviar para" onEdit={() => setStep(2)} />
        <p className="mt-3 text-sm">
          {form.street}, {form.number}
          {form.complement ? ` - ${form.complement}` : ""}
        </p>
        <p className="mt-1 text-sm text-[#A0A0A0]">
          {form.neighborhood}, {form.city}/{form.state} {form.cep}
        </p>
        <p className="mt-4 font-display text-xs font-bold tracking-[0.14em] uppercase">Frete selecionado</p>
        <p className="mt-1 flex items-center gap-2 text-sm text-[#A0A0A0]">
          {form.shipping === "full" ? <MercadoFullBadge className="h-4" /> : "Frete grátis"} · {freight > 0 ? formatBRL(freight) : "Grátis"}
        </p>
      </StepCard>
    ) : (
      <StepCard muted>
        <StepHead title="Entrega" step="2 de 3" sub="Preencha os dados pessoais para continuar" muted />
      </StepCard>
    );

  const payCard =
    step < 3 ? (
      <StepCard muted>
        <StepHead title="Pagamento" step="3 de 3" sub={step === 1 ? "Preencha os dados de entrega para continuar" : "Todas as transações são seguras e criptografadas."} muted />
      </StepCard>
    ) : (
      <StepCard>
        <StepHead title="Pagamento" step="3 de 3" sub="Todas as transações são seguras e criptografadas." />
        <div className="mt-5 space-y-5">
          {ORDER_BUMPS.map((offer, index) => (
            <OrderBump key={offer.id} offer={offer} reveal={index > 0} checked={bumpIds.includes(offer.id)} onChange={(on) => toggleBump(offer.id, on)} />
          ))}

          {cardEnabled ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set("payment", "pix")}
                className={cn("border px-4 py-3 font-display text-sm font-bold uppercase", form.payment === "pix" ? "border-[#CC2222] bg-[#CC2222]" : "border-white/15")}
              >
                PIX
              </button>
              <button
                type="button"
                onClick={() => set("payment", "card")}
                className={cn("border px-4 py-3 font-display text-sm font-bold uppercase", form.payment === "card" ? "border-[#CC2222] bg-[#CC2222]" : "border-white/15")}
              >
                Cartão · até {INSTALLMENTS}x
              </button>
            </div>
          ) : null}

          {payWithPix ? (
            <div className="border border-[#CC2222] bg-[#CC2222]/[0.06]">
              <div className="flex items-center gap-3 p-3">
                <Radio on />
                <span className="flex h-9 w-9 items-center justify-center bg-[#111]">
                  <PixIcon className="h-5 w-5" />
                </span>
                <span className="flex-1 font-display text-base font-bold uppercase">PIX</span>
                <span className="bg-emerald-500/15 px-2 py-0.5 font-display text-[11px] font-black text-emerald-400 uppercase">Aprovação na hora</span>
              </div>
              <div className="px-4 pb-4">
                <p className="text-sm text-[#A0A0A0]">
                  O código PIX expira em 30 minutos após finalizar a compra. O capacete é separado assim que o pagamento é confirmado.
                </p>
                <p className="mt-3 text-sm text-[#A0A0A0]">
                  Valor no PIX: <b className="font-display text-xl text-emerald-400">{formatBRL(pixTotal)}</b>
                </p>
                {error ? (
                  <p role="alert" className="mt-3 text-sm text-[#CC2222]">
                    {error}
                  </p>
                ) : null}
                <PrimaryButton type="button" disabled={loading} onClick={() => void finish()} className="mt-4">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Finalizar compra
                </PrimaryButton>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <p className="text-sm text-[#6A6A6A] sm:col-span-2">
                Escolha em quantas vezes, até {INSTALLMENTS}x. Parcelamento com taxa de {Math.round(INSTALLMENT_FEE * 100)}%. O banco pode pedir confirmação 3DS.
              </p>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs tracking-wide text-[#6A6A6A] uppercase">Parcelas</span>
                <select
                  value={form.installments}
                  onChange={(e) => set("installments", clampInstallments(e.target.value))}
                  className="h-12 w-full border border-white/15 bg-[#080808] px-3 outline-none"
                >
                  {Array.from({ length: INSTALLMENTS }, (_, i) => i + 1).map((n) => {
                    const total = (cardBaseCents + installmentFeeCents(cardBaseCents, n)) / 100;
                    const share = total / n;
                    return (
                      <option key={n} value={n}>
                        {n === 1 ? `1x de ${formatBRL(share)} à vista` : `${n}x de ${formatBRL(share)} · total ${formatBRL(total)}`}
                      </option>
                    );
                  })}
                </select>
              </label>
              <Field label="Nome no cartão" wrap="sm:col-span-2" value={form.cardName} autoComplete="cc-name" onChange={(e) => set("cardName", e.target.value)} />
              <Field
                label="Número"
                wrap="sm:col-span-2"
                inputMode="numeric"
                autoComplete="cc-number"
                value={form.cardNumber}
                onChange={(e) => set("cardNumber", onlyDigits(e.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "))}
              />
              <Field
                label="Validade"
                placeholder="MM/AA"
                autoComplete="cc-exp"
                value={form.cardExpiry}
                onChange={(e) =>
                  set(
                    "cardExpiry",
                    onlyDigits(e.target.value)
                      .slice(0, 4)
                      .replace(/(\d{2})(\d{0,2})/, (_, a, b) => (b ? `${a}/${b}` : a)),
                  )
                }
              />
              <Field label="CVV" inputMode="numeric" autoComplete="cc-csc" value={form.cardCvv} onChange={(e) => set("cardCvv", onlyDigits(e.target.value).slice(0, 4))} />
              {error ? (
                <p role="alert" className="text-sm text-[#CC2222] sm:col-span-2">
                  {error}
                </p>
              ) : null}
              <PrimaryButton type="button" disabled={loading} onClick={() => void finish()} className="sm:col-span-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Pagar {formatBRL(cardTotal)}
              </PrimaryButton>
            </div>
          )}
        </div>
      </StepCard>
    );

  return (
    <div className="pb-10">
      <SummaryMobile {...summary} />
      <div className="mx-auto grid w-full max-w-[1160px] gap-4 px-3 pt-4 md:px-4 lg:grid-cols-3">
        <div className="space-y-4">
          {idCard}
          {addrCard}
        </div>
        <div>{payCard}</div>
        <SummaryDesktop {...summary} />
      </div>
    </div>
  );
}
