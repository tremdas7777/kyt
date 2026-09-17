import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useEffect, useRef, type FormEvent } from "react";

import { ShippingPicker } from "@/components/checkout/ShippingPicker";
import { MercadoFullBadge } from "@/components/checkout/MercadoFullBadge";
import {
  assetUrl,
  catalogPriceFor,
  clampInstallments,
  INSTALLMENT_FEE,
  INSTALLMENTS,
  installmentFeeCents,
  pixPrice,
} from "@/data/catalog";
import { useCart, type CheckoutPayload, type PaymentStatus } from "@/lib/cart";
import { formatBRL, formatCep, formatCpf, formatPhone, onlyDigits } from "@/lib/format";
import { getAttribution, newEventId, pingLive, trackEvent } from "@/lib/pixel-client";
import {
  asRecord,
  fetchLegacyPublicConfig,
  loadLegacyPay,
  newReferenceId,
  type JsonRecord,
} from "@/lib/legacy-pay";
import { createPayin, type PayinResponse } from "@/lib/payin-client";
import { shippingLabel, shippingPrice, type ShippingMethod } from "@/lib/shipping";
import { useCardEnabled } from "@/lib/payment-options";
import { STOREFRONT_ALLOWS_CARD } from "@/lib/payment-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout | KYT Capacetes Brasil" }] }),
  component: CheckoutPage,
});

const states = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE",
  "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

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
  state: "SP",
  payment: "pix",
  shipping: "gratis",
  installments: 1,
  cardName: "",
  cardNumber: "",
  cardExpiry: "",
  cardCvv: "",
};

function unitPrice(productId: string, fallback: number) {
  return catalogPriceFor(productId, fallback);
}

function toCents(value: number) {
  return Math.max(1, Math.round(value * 100));
}

function chargedCents(
  items: { productId: string; price: number; quantity: number }[],
  method: "PIX" | "CREDIT_CARD",
) {
  let amount = 0;
  for (const item of items) {
    const unit = unitPrice(item.productId, item.price);
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
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}

function mapStatus(status: unknown): PaymentStatus {
  const value = String(status ?? "").toLowerCase().trim();
  if (
    ["paid", "pago", "aprovado", "approved", "confirmado", "confirmed", "liquidado", "completed", "complete", "success", "succeeded", "settled", "received", "done"].includes(
      value,
    )
  ) {
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
  if (rec.code === "THREEDS_SDK_UNAVAILABLE") {
    return "Não foi possível carregar a autenticação do cartão. Desative bloqueadores e tente de novo.";
  }
  if (typeof rec.message === "string" && rec.message.trim()) return rec.message;
  if (error instanceof Error && error.message) return error.message;
  return "Falha no pagamento. Tente novamente.";
}

function CheckoutPage() {
  const { items, placeOrder, hydrated, closeCart, updateQty, removeItem } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const cardEnabled = STOREFRONT_ALLOWS_CARD && useCardEnabled();
  const checkoutTracked = useRef(false);
  const cardItems = useMemo(() => chargedCents(items, "CREDIT_CARD") / 100, [items]);
  const pixItems = useMemo(() => chargedCents(items, "PIX") / 100, [items]);
  const freight = shippingPrice(form.shipping);
  const freightCents = Math.max(0, Math.round(freight * 100));
  const cardBaseCents = chargedCents(items, "CREDIT_CARD") + freightCents;
  const feeCents = installmentFeeCents(cardBaseCents, form.installments);
  const cardTotal = (cardBaseCents + feeCents) / 100;
  const pixTotal = pixItems + freight;
  const payWithPix = !cardEnabled || form.payment === "pix";
  const payable = payWithPix ? pixTotal : cardTotal;
  const installmentShare = cardTotal / form.installments;

  useEffect(() => {
    closeCart();
  }, [closeCart]);

  useEffect(() => {
    if (!cardEnabled) setForm((current) => ({ ...current, payment: "pix" }));
  }, [cardEnabled]);

  useEffect(() => {
    if (!hydrated || items.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    const contents = items.map((item) => ({
      id: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));
    trackEvent({
      event: "InitiateCheckout",
      eventId: newEventId("ic"),
      value: pixTotal,
      contents,
    });
  }, [hydrated, items, pixTotal]);

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const timer = window.setTimeout(() => {
      pingLive({
        event: "heartbeat",
        path: "/checkout",
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hydrated, items.length, form.name, form.email, form.phone]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function lookupCep(cep: string) {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) return;
      setForm((current) => ({
        ...current,
        street: data.logradouro ?? current.street,
        neighborhood: data.bairro ?? current.neighborhood,
        city: data.localidade ?? current.city,
        state: data.uf ?? current.state,
      }));
    } catch {
      // ignore lookup errors and keep manual address entry
    }
  }

  function buildCustomer(): CheckoutPayload {
    const customer: CheckoutPayload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      cpf: form.cpf,
      cep: form.cep,
      street: form.street,
      number: form.number,
      complement: form.complement,
      neighborhood: form.neighborhood,
      city: form.city,
      state: form.state,
      payment: form.payment,
    };
    return customer;
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
      address: {
        street: form.street.trim(),
        number: form.number.trim(),
        zipCode: onlyDigits(form.cep),
        city: form.city.trim(),
        state: form.state,
      },
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
      await client.prepareCardPayment({
        amount,
        installments: form.installments,
        referenceId,
        card: cardInput,
        customer: sdkCustomer,
      }),
    );
    const payinCard = asRecord(prepared["payinCard"]);
    const token = String(payinCard["token"] ?? prepared["token"] ?? "").trim();
    if (!token.startsWith("cvt_")) {
      throw new Error("Não foi possível tokenizar o cartão. Tente outro cartão.");
    }

    const payload = orderPayload(referenceId, "CREDIT_CARD");
    const card: JsonRecord = { token, installments: form.installments };
    if (payinCard["threeDSecure"] && typeof payinCard["threeDSecure"] === "object") {
      card["threeDSecure"] = payinCard["threeDSecure"];
    }
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

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (items.length === 0) {
      setError("Seu carrinho está vazio.");
      return;
    }
    if (!form.name || !form.email || onlyDigits(form.phone).length < 10 || onlyDigits(form.cpf).length !== 11) {
      setError("Preencha nome, e-mail, telefone e CPF.");
      return;
    }
    if (onlyDigits(form.cep).length !== 8 || !form.street || !form.number || !form.neighborhood || !form.city) {
      setError("Preencha o endereço completo.");
      return;
    }
    if (form.payment === "card") {
      if (!cardEnabled) {
        setError("Pagamento com cartão está desativado. Use PIX.");
        return;
      }
      if (onlyDigits(form.cardNumber).length < 16 || form.cardCvv.length < 3 || !form.cardName || !parseExpiry(form.cardExpiry)) {
        setError("Preencha os dados do cartão.");
        return;
      }
    }

    setLoading(true);
    try {
      trackEvent({
        event: "AddPaymentInfo",
        eventId: newEventId("pay"),
        value: payable,
        contents: items.map((item) => ({
          id: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          cpf: form.cpf,
          city: form.city,
          state: form.state,
          cep: form.cep,
        },
      });
      const referenceId = newReferenceId();
      const customer = buildCustomer();
      let result: PayinResponse;
      let extrasTotal = pixTotal;
      let extrasDiscount = Math.max(0, Math.round((cardItems - pixItems) * 100) / 100);

      if (!payWithPix) {
        const paid = await payWithCard(referenceId);
        result = paid.result;
        customer.cardName = form.cardName.trim();
        customer.cardLast4 = paid.last4;
        extrasTotal = cardTotal;
        extrasDiscount = 0;
      } else {
        result = await createPayin(orderPayload(referenceId, "PIX"));
      }

      const pixCode = String(result.pixCode ?? result["copy_and_paste"] ?? result["qr_code"] ?? "").trim();
      const pixImage = String(result.pixImage ?? result["qr_code_image_url"] ?? "").trim();
      if (form.payment === "pix" && !pixCode) {
        throw new Error("Não foi possível gerar o PIX. Tente novamente.");
      }
      const eventId = `pur_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const order = placeOrder(customer, {
        total: extrasTotal,
        discount: extrasDiscount,
        shipping: freight,
        shippingMethod: form.shipping,
        paymentStatus: mapStatus(result.status),
        eventId,
        ...(result.transactionId ? { transactionId: String(result.transactionId) } : {}),
        ...(result.referenceId ? { referenceId: String(result.referenceId) } : { referenceId }),
        ...(pixCode ? { pix: { code: pixCode, image: pixImage } } : {}),
        ...(payWithPix ? {} : { installments: form.installments }),
        paymentGateway: payWithPix ? (result.paymentGateway === "magicpay" ? "magicpay" : "legacy") : "legacy",
      });
      pingLive({
        event: order.paymentStatus === "paid" ? "Purchase" : "CompletePayment",
        path: order.paymentStatus === "paid" ? `/obrigado/${order.id}` : `/pedido/${order.id}`,
        orderId: order.id,
        paymentStatus: order.paymentStatus === "paid" ? "paid" : "pending",
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
        cartItems: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
      });
      try {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...order,
            eventId,
            attribution: getAttribution(),
            userAgent: navigator.userAgent,
          }),
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
        contents: order.items.map((item) => ({
          id: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        customer: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          cpf: customer.cpf,
          city: customer.city,
          state: customer.state,
          cep: customer.cep,
        },
      });
      if (order.paymentStatus === "paid") {
        await navigate({ to: "/obrigado/$id", params: { id: order.id } });
      } else {
        await navigate({ to: "/pedido/$id", params: { id: order.id } });
      }
    } catch (err) {
      console.error("[checkout] pagamento", (err as { code?: string })?.code, paymentErrorMessage(err));
      setError(paymentErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <section className="pt-28 pb-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-10">
          <h1 className="font-display text-5xl font-black uppercase">Checkout</h1>
          <p className="mt-4 text-[#6A6A6A]">Carregando pedido...</p>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="pt-28 pb-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Checkout</h1>
        <p className="mt-4 text-[#6A6A6A]">Adicione um capacete para continuar.</p>
        <Link to="/produtos" className="kyt-btn kyt-btn-primary mt-6">
          Ver produtos
        </Link>
      </section>
    );
  }

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <form onSubmit={onSubmit} className="space-y-8">
          <h1 className="font-display text-5xl font-black uppercase">Checkout</h1>

          <fieldset>
            <legend className="mb-4 font-display text-sm font-bold tracking-[0.16em] uppercase">Seus dados</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo" className="sm:col-span-2">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </Field>
              <Field label="E-mail">
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Field label="Telefone">
                <input
                  value={form.phone}
                  onChange={(e) => set("phone", formatPhone(e.target.value))}
                  inputMode="tel"
                  required
                />
              </Field>
              <Field label="CPF" className="sm:col-span-2">
                <input value={form.cpf} onChange={(e) => set("cpf", formatCpf(e.target.value))} required />
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-4 font-display text-sm font-bold tracking-[0.16em] uppercase">Entrega</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CEP">
                <input
                  value={form.cep}
                  onChange={(e) => {
                    const next = formatCep(e.target.value);
                    set("cep", next);
                    if (onlyDigits(next).length === 8) void lookupCep(next);
                  }}
                  required
                />
              </Field>
              <Field label="Número">
                <input value={form.number} onChange={(e) => set("number", e.target.value)} required />
              </Field>
              <Field label="Endereço" className="sm:col-span-2">
                <input value={form.street} onChange={(e) => set("street", e.target.value)} required />
              </Field>
              <Field label="Complemento">
                <input value={form.complement} onChange={(e) => set("complement", e.target.value)} />
              </Field>
              <Field label="Bairro">
                <input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} required />
              </Field>
              <Field label="Cidade">
                <input value={form.city} onChange={(e) => set("city", e.target.value)} required />
              </Field>
              <Field label="Estado">
                <select value={form.state} onChange={(e) => set("state", e.target.value)}>
                  {states.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-4 font-display text-sm font-bold tracking-[0.16em] uppercase">Frete</legend>
            <ShippingPicker value={form.shipping} onChange={(value) => set("shipping", value)} />
          </fieldset>

          <fieldset>
            <legend className="mb-4 font-display text-sm font-bold tracking-[0.16em] uppercase">Pagamento</legend>
            {cardEnabled ? (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => set("payment", "pix")}
                className={cn(
                  "border px-4 py-3 font-display text-sm font-bold uppercase",
                  form.payment === "pix" ? "border-[#CC2222] bg-[#CC2222]" : "border-white/15",
                )}
              >
                PIX · 10% OFF
              </button>
              <button
                type="button"
                onClick={() => set("payment", "card")}
                className={cn(
                  "border px-4 py-3 font-display text-sm font-bold uppercase",
                  form.payment === "card" ? "border-[#CC2222] bg-[#CC2222]" : "border-white/15",
                )}
              >
                Cartão · até {INSTALLMENTS}x
              </button>
            </div>
            ) : null}
            {payWithPix ? (
              <p className="text-sm text-[#6A6A6A]">
                Pagamento no PIX com 10% OFF. Após confirmar, você recebe o QR Code no valor de {formatBRL(pixTotal)}.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-sm text-[#6A6A6A]">
                  Escolha em quantas vezes, até {INSTALLMENTS}x. Parcelamento com taxa de {Math.round(INSTALLMENT_FEE * 100)}%. O banco pode pedir confirmação 3DS.
                </p>
                <Field label="Parcelas" className="sm:col-span-2">
                  <select
                    value={form.installments}
                    onChange={(e) => set("installments", clampInstallments(e.target.value))}
                  >
                    {Array.from({ length: INSTALLMENTS }, (_, i) => i + 1).map((n) => {
                      const total = (cardBaseCents + installmentFeeCents(cardBaseCents, n)) / 100;
                      const share = total / n;
                      return (
                        <option key={n} value={n}>
                          {n === 1
                            ? `1x de ${formatBRL(share)} à vista`
                            : `${n}x de ${formatBRL(share)} · total ${formatBRL(total)}`}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <Field label="Nome no cartão" className="sm:col-span-2">
                  <input value={form.cardName} onChange={(e) => set("cardName", e.target.value)} autoComplete="cc-name" />
                </Field>
                <Field label="Número" className="sm:col-span-2">
                  <input
                    value={form.cardNumber}
                    onChange={(e) =>
                      set("cardNumber", onlyDigits(e.target.value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "))
                    }
                    inputMode="numeric"
                    autoComplete="cc-number"
                  />
                </Field>
                <Field label="Validade">
                  <input
                    placeholder="MM/AA"
                    value={form.cardExpiry}
                    autoComplete="cc-exp"
                    onChange={(e) =>
                      set(
                        "cardExpiry",
                        onlyDigits(e.target.value)
                          .slice(0, 4)
                          .replace(/(\d{2})(\d{0,2})/, (_, a, b) => (b ? `${a}/${b}` : a)),
                      )
                    }
                  />
                </Field>
                <Field label="CVV">
                  <input
                    value={form.cardCvv}
                    onChange={(e) => set("cardCvv", onlyDigits(e.target.value).slice(0, 4))}
                    inputMode="numeric"
                    autoComplete="cc-csc"
                  />
                </Field>
              </div>
            )}
          </fieldset>

          {error ? <p className="text-sm text-[#CC2222]">{error}</p> : null}
          <button type="submit" disabled={loading} className="kyt-btn kyt-btn-primary w-full">
            {loading ? "Processando..." : `Pagar ${formatBRL(payable)}`}
          </button>
        </form>

        <aside className="h-fit border border-white/10 bg-[#0e0e0e] p-6">
          <h2 className="font-display text-lg font-bold uppercase">Pedido</h2>
          <p className="mt-1 text-xs text-[#6A6A6A]">Altere quantidades ou exclua itens antes de pagar.</p>
          <ul className="mt-4 divide-y divide-white/10">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 py-3">
                <img src={assetUrl(item.image)} alt="" className="h-16 w-12 bg-[#111] object-contain" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold uppercase">{item.name}</p>
                  <p className="text-xs text-[#6A6A6A]">
                    {item.color} · Tam. {item.size}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center border border-white/15">
                      <button
                        type="button"
                        className="p-2 disabled:opacity-40"
                        disabled={loading}
                        onClick={() => updateQty(item.id, item.quantity - 1)}
                        aria-label={`Diminuir ${item.name}`}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        className="p-2 disabled:opacity-40"
                        disabled={loading}
                        onClick={() => updateQty(item.id, item.quantity + 1)}
                        aria-label={`Aumentar ${item.name}`}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-[#6A6A6A] hover:text-[#CC2222] disabled:opacity-40"
                      disabled={loading}
                      onClick={() => removeItem(item.id)}
                      aria-label={`Excluir ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm">{formatBRL(unitPrice(item.productId, item.price) * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between text-sm text-[#6A6A6A]">
            <span className="flex items-center gap-2">
              Frete
              {form.shipping === "full" ? <MercadoFullBadge className="h-5" /> : null}
            </span>
            <span>{freight > 0 ? formatBRL(freight) : "Grátis"}</span>
          </div>
          <p className="mt-1 text-xs text-[#6A6A6A]">{shippingLabel(form.shipping)}</p>
          {payWithPix ? (
            <>
              <div className="mt-2 flex justify-between text-sm text-[#6A6A6A]">
                <span>Subtotal</span>
                <span>{formatBRL(cardItems)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm text-[#CC2222]">
                <span>Desconto PIX 10%</span>
                <span>−{formatBRL(cardItems - pixItems)}</span>
              </div>
            </>
          ) : (
            <>
              {feeCents > 0 ? (
                <div className="mt-2 flex justify-between text-sm text-[#6A6A6A]">
                  <span>Taxa de parcelamento {Math.round(INSTALLMENT_FEE * 100)}%</span>
                  <span>{formatBRL(feeCents / 100)}</span>
                </div>
              ) : null}
              <div className="mt-2 flex justify-between text-sm text-[#6A6A6A]">
                <span>
                  {form.installments === 1
                    ? "1x à vista"
                    : `${form.installments}x de ${formatBRL(installmentShare)}`}
                </span>
                <span>{formatBRL(installmentShare)}</span>
              </div>
            </>
          )}
          <div className="mt-3 flex justify-between border-t border-white/10 pt-3 font-display text-2xl font-black">
            <span>Total</span>
            <span>{formatBRL(payable)}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs tracking-wide text-[#6A6A6A] uppercase">{label}</span>
      <div className="[&_input]:h-11 [&_input]:w-full [&_input]:border [&_input]:border-white/15 [&_input]:bg-transparent [&_input]:px-3 [&_input]:outline-none [&_input]:focus:border-[#CC2222] [&_select]:h-11 [&_select]:w-full [&_select]:border [&_select]:border-white/15 [&_select]:bg-[#080808] [&_select]:px-3 [&_select]:outline-none">
        {children}
      </div>
    </label>
  );
}
