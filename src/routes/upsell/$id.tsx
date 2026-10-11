import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CircleCheck, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { assetUrl } from "@/data/catalog";
import { offerCartItem, SEGURO_KYT, visorOfferFor, type Offer } from "@/data/offers";
import { useCart, type Order } from "@/lib/cart";
import { formatBRL, onlyDigits } from "@/lib/format";
import { newReferenceId } from "@/lib/legacy-pay";
import { createPayin } from "@/lib/payin-client";
import { usePixGateway } from "@/lib/payment-options";
import { isPixGateway } from "@/lib/payment-types";
import { getAttribution, newEventId, pingLive, trackEvent } from "@/lib/pixel-client";
import { mapPaymentStatus } from "@/routes/checkout";

export const Route = createFileRoute("/upsell/$id")({
  head: () => ({ meta: [{ title: "Oferta especial | KYT Capacetes Brasil" }, { name: "robots", content: "noindex" }] }),
  component: UpsellPage,
});

/**
 * Ofertas pós-compra (como na Aidex): viseira fumê original do modelo comprado e o Seguro KYT
 * (quando não foi pego no checkout). O que o cliente marcar vai numa cobrança PIX separada,
 * ligada ao pedido principal; depois (comprando ou não) vem a página de obrigado.
 */
function UpsellPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { getOrder, getChildOrders, placeExtraOrder, hydrated } = useCart();
  const pixGatewayHint = usePixGateway();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [chosen, setChosen] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    const found = getOrder(id);
    // Sem pedido neste aparelho, pedido extra ou já ofertado: segue para o obrigado.
    if (!found || found.parentOrderId || getChildOrders(id).length > 0) {
      void navigate({ to: "/obrigado/$id", params: { id }, replace: true });
      return;
    }
    setOrder(found);
  }, [hydrated, id, getOrder, getChildOrders, navigate]);

  const offers = useMemo<Offer[]>(() => {
    if (!order) return [];
    const helmets = order.items.filter((item) => !item.id.startsWith("offer::"));
    const visors = new Map<string, Offer>();
    for (const item of helmets) {
      const visor = visorOfferFor(item.productId);
      if (visor) visors.set(visor.id, visor);
    }
    const hasSeguro = order.items.some((item) => item.productId === SEGURO_KYT.id);
    return [...visors.values(), ...(hasSeguro ? [] : [SEGURO_KYT])];
  }, [order]);

  const selected = offers.filter((offer) => chosen.includes(offer.id));
  const total = Math.round(selected.reduce((sum, offer) => sum + offer.price, 0) * 100) / 100;

  function toggle(offerId: string) {
    setChosen((current) => (current.includes(offerId) ? current.filter((entry) => entry !== offerId) : [...current, offerId]));
  }

  async function generatePix() {
    if (!order || selected.length === 0) return;
    setLoading(true);
    setError("");
    const referenceId = newReferenceId();
    const customer = order.customer;
    try {
      const result = await createPayin({
        paymentMethod: "PIX",
        referenceId,
        comprador: { nome: customer.name, email: customer.email, telefone: onlyDigits(customer.phone), cpf: onlyDigits(customer.cpf) },
        entrega: {
          endereco: customer.street,
          numero: customer.number,
          complemento: customer.complement,
          bairro: customer.neighborhood,
          cidade: customer.city,
          estado: customer.state,
          cep: onlyDigits(customer.cep),
        },
        carrinho: [],
        extras: selected.map((offer) => ({ id: offer.id })),
        shippingCents: 0,
        shippingMethod: "gratis",
        parentOrderId: order.id,
      });
      const pixCode = String(result.pixCode ?? result["copy_and_paste"] ?? result["qr_code"] ?? "").trim();
      const pixImage = String(result.pixImage ?? result["qr_code_image_url"] ?? "").trim();
      if (!pixCode) throw new Error("Não foi possível gerar o PIX. Tente novamente.");
      const eventId = `pur_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const extraItems = selected.map(offerCartItem);
      const child = placeExtraOrder(order, extraItems, {
        total,
        discount: 0,
        paymentStatus: mapPaymentStatus(result.status),
        eventId,
        ...(result.transactionId ? { transactionId: String(result.transactionId) } : {}),
        ...(result.referenceId ? { referenceId: String(result.referenceId) } : { referenceId }),
        pix: { code: pixCode, image: pixImage },
        paymentGateway: isPixGateway(result.paymentGateway) ? result.paymentGateway : pixGatewayHint,
      });
      pingLive({
        event: "CompletePayment",
        path: `/pedido/${child.id}`,
        orderId: child.id,
        paymentStatus: "pending",
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
        cartItems: child.items,
      });
      try {
        await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...child, eventId, attribution: getAttribution(), userAgent: navigator.userAgent }),
          keepalive: true,
        });
      } catch {
        // o painel tenta de novo no status/webhook
      }
      trackEvent({
        event: "CompletePayment",
        eventId,
        value: child.total,
        orderId: child.id,
        contents: child.items.map((item) => ({ id: item.productId, name: item.name, quantity: item.quantity, price: item.price })),
        customer: { name: customer.name, email: customer.email, phone: customer.phone, cpf: customer.cpf, city: customer.city, state: customer.state, cep: customer.cep },
      });
      await navigate({ to: "/pedido/$id", params: { id: child.id }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o PIX agora. Tente novamente em alguns segundos.");
    } finally {
      setLoading(false);
    }
  }

  if (!order) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (offers.length === 0) {
    void navigate({ to: "/obrigado/$id", params: { id }, replace: true });
    return null;
  }

  const firstName = order.customer.name.trim().split(/\s+/)[0] ?? "";

  return (
    <section className="mx-auto max-w-[560px] px-4 pt-6 pb-16">
      <div className="flex items-center justify-center gap-2 bg-emerald-500/15 px-4 py-3 font-display text-sm font-bold uppercase text-emerald-400">
        <CircleCheck className="h-4 w-4 shrink-0" /> Pagamento aprovado! Seu pedido está confirmado.
      </div>

      <p className="mt-8 text-center font-display text-xs font-black tracking-[0.18em] text-amber-400 uppercase">Espere, {firstName}! Ofertas únicas para você</p>
      <h1 className="mt-2 text-center font-display text-3xl font-black uppercase leading-tight md:text-4xl">Complete o seu capacete</h1>
      <p className="mt-2 text-center text-sm text-[#A0A0A0]">Marque o que quiser adicionar. Você paga tudo num PIX só e vai na mesma caixa.</p>

      {offers.map((offer) => (
        <OfferCard key={offer.id} checked={chosen.includes(offer.id)} onToggle={() => toggle(offer.id)}>
          <div className="flex items-center gap-4">
            {offer.image ? (
              <img src={assetUrl(offer.image)} alt={offer.fullName} className="h-20 w-20 shrink-0 border border-white/10 bg-[#111] object-contain" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center border border-white/10 bg-[#111]">
                <ShieldCheck className="h-10 w-10 text-emerald-400" strokeWidth={1.5} />
              </span>
            )}
            <div>
              <p className="font-display text-xs font-black tracking-[0.14em] text-emerald-400 uppercase">Só nesta tela</p>
              <p className="font-display text-lg font-bold uppercase leading-tight">+ {offer.fullName}</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                {offer.compareAt ? <span className="text-sm text-[#6A6A6A] line-through">{formatBRL(offer.compareAt)}</span> : null}
                <span className="font-display text-2xl font-black text-emerald-400">{formatBRL(offer.price)}</span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[#A0A0A0]">{offer.body}</p>
          <ul className="mt-3 space-y-1.5 text-[13px]">
            {offer.benefits.map((benefit) => (
              <li key={benefit} className="flex gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </OfferCard>
      ))}

      {error ? (
        <p role="alert" className="mt-4 text-center text-sm text-[#CC2222]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loading || selected.length === 0}
        onClick={() => void generatePix()}
        className="kyt-btn kyt-btn-primary mt-6 w-full flex-col gap-0 py-4 disabled:opacity-50"
      >
        <span className="flex items-center gap-2 text-base">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Gerar PIX
        </span>
        <span className="text-xs font-medium tracking-normal normal-case opacity-90">
          {selected.length === 0 ? "Marque uma oferta acima" : `${formatBRL(total)} no PIX`}
        </span>
      </button>

      <Link to="/obrigado/$id" params={{ id }} replace className="mt-4 block text-center text-sm text-[#6A6A6A] underline hover:text-white">
        Não, obrigado. Quero só o meu pedido.
      </Link>
    </section>
  );
}

function OfferCard({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <label className={`mt-5 block cursor-pointer border-2 p-4 transition-colors ${checked ? "border-emerald-500 bg-emerald-500/[0.05]" : "border-white/15 hover:border-white/40"}`}>
      <div className="flex gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-5 w-5 shrink-0 accent-emerald-500" />
        <div className="flex-1">{children}</div>
      </div>
    </label>
  );
}
