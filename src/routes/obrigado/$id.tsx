import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { MercadoFullBadge } from "@/components/checkout/MercadoFullBadge";
import { Pill } from "@/routes/pedido/$id";
import { useCart, type Order, type PaymentStatus } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { checkPayinStatus } from "@/lib/payin-client";
import { trackEvent } from "@/lib/pixel-client";

export const Route = createFileRoute("/obrigado/$id")({
  head: () => ({
    meta: [
      { title: "Pagamento confirmado | KYT Capacetes Brasil" },
      {
        name: "description",
        content: "Confirmação do seu pedido de capacete KYT: pagamento aprovado e envio em preparação.",
      },
      { property: "og:title", content: "Pagamento confirmado | KYT Capacetes Brasil" },
      {
        property: "og:description",
        content: "Confirmação do seu pedido de capacete KYT: pagamento aprovado e envio em preparação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ThankYouPage,
});

function ThankYouPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { getOrder, getChildOrders, updateOrderPayment, hydrated } = useCart();
  const [order, setOrder] = useState<Order | undefined>();
  const [extras, setExtras] = useState<Order[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const tracked = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    const found = getOrder(id);
    // Cobrança extra: o obrigado é sempre o do pedido principal.
    if (found?.parentOrderId) {
      void navigate({ to: "/obrigado/$id", params: { id: found.parentOrderId }, replace: true });
      return;
    }
    setOrder(found);
    if (found) {
      setStatus(found.paymentStatus);
      setExtras(getChildOrders(found.id).filter((child) => child.paymentStatus === "paid"));
    }
  }, [getOrder, getChildOrders, hydrated, id, navigate]);

  // Só liberamos a página de obrigado depois de o gateway confirmar o pagamento.
  useEffect(() => {
    if (!order || confirmed) return;
    const tx = order.transactionId ?? "";
    const ref = order.referenceId ?? "";
    const gateway = order.paymentGateway;
    if (!tx && !ref) {
      if (order.paymentStatus === "paid") setConfirmed(true);
      return;
    }

    let cancelled = false;
    async function poll() {
      try {
        const remote = await checkPayinStatus(tx, ref, gateway);
        if (cancelled) return;
        if (remote === "paid") {
          updateOrderPayment(id, "paid");
          setStatus("paid");
          setConfirmed(true);
          return;
        }
        if (remote === "failed") {
          updateOrderPayment(id, "failed");
          setStatus("failed");
        }
      } catch {
        // segue tentando; o webhook pode confirmar depois
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [confirmed, id, order, updateOrderPayment]);

  useEffect(() => {
    if (!confirmed || !order || tracked.current) return;
    tracked.current = true;
    trackEvent({
      event: "Purchase",
      eventId: order.eventId || `pur_${order.id}`,
      value: order.total,
      orderId: order.id,
      contents: order.items.map((item) => ({
        id: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      customer: {
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        cpf: order.customer.cpf,
        city: order.customer.city,
        state: order.customer.state,
        cep: order.customer.cep,
      },
    });
  }, [confirmed, order]);

  if (!hydrated) {
    return (
      <section className="pt-10 pb-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Pedido</h1>
        <p className="mt-4 text-[#6A6A6A]">Carregando...</p>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="pt-10 pb-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Pedido não encontrado</h1>
        <Link to="/produtos" className="kyt-btn kyt-btn-primary mt-6">
          Ir para a loja
        </Link>
      </section>
    );
  }

  if (!confirmed) {
    const isPix = order.customer.payment === "pix";
    return (
      <section className="pt-10 pb-20">
        <div className="mx-auto max-w-2xl px-6 text-center lg:px-10">
          <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">
            {status === "failed" ? "Pagamento não concluído" : "Aguardando confirmação"}
          </p>
          <h1 className="mt-4 font-display text-4xl font-black uppercase md:text-5xl">
            {status === "failed" ? "Não foi possível concluir" : "Confirmando seu pagamento"}
          </h1>
          <p className="mt-4 text-[#6A6A6A]">
            Pedido <span className="text-white">{order.id}</span>.{" "}
            {status === "failed"
              ? "Tente novamente com outro cartão ou pague no PIX."
              : isPix
                ? "Assim que o PIX cair, esta página confirma sozinha."
                : "Estamos confirmando com o banco. Esta página atualiza sozinha."}
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/pedido/$id", params: { id: order.id } })}
            className="kyt-btn kyt-btn-outline mt-8"
          >
            {isPix && status !== "failed" ? "Ver o código PIX" : "Ver o pedido"}
          </button>
        </div>
      </section>
    );
  }

  const firstName = order.customer.name.split(" ")[0] ?? "";
  const extrasTotal = extras.reduce((sum, child) => sum + child.total, 0);

  return (
    <section className="pt-10 pb-20">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
        <Pill variant="approved" />
        <p className="mt-4 font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">
          Pagamento confirmado
        </p>
        <h1 className="mt-4 font-display text-5xl font-black uppercase">Obrigado, {firstName}</h1>
        <p className="mt-4 text-[#6A6A6A]">
          Pedido <span className="text-white">{order.id}</span> pago
          {order.customer.payment === "pix"
            ? " no PIX"
            : ` no cartão final ${order.customer.cardLast4 ?? "****"}${order.installments ? ` em ${order.installments}x` : ""}`}
          . Enviamos os detalhes para {order.customer.email}.
        </p>

        <div className="mx-auto mt-8 grid max-w-xl gap-3 border border-white/10 p-6 text-left">
          <p className="font-display text-sm font-bold tracking-[0.16em] uppercase">Próximos passos</p>
          <p className="text-sm text-[#6A6A6A]">1. Separação e conferência do capacete em até 1 dia útil.</p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-[#6A6A6A]">
            2. Envio{" "}
            {order.shippingMethod === "full" ? (
              <>
                <MercadoFullBadge className="h-4" /> em 3 a 5 dias úteis
              </>
            ) : (
              "grátis em 5 a 8 dias úteis"
            )}{" "}
            e código de rastreio por e-mail.
          </p>
          <p className="text-sm text-[#6A6A6A]">3. Qualquer dúvida, fale com a gente pela página de contato.</p>
        </div>

        <ul className="mt-10 divide-y divide-white/10 border-t border-white/10 text-left">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between py-4">
              <span>
                {item.name} · {item.color} · {item.size} × {item.quantity}
              </span>
              <span>{formatBRL(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        {order.discount > 0 ? (
          <p className="mt-4 text-sm text-[#CC2222]">Desconto PIX −{formatBRL(order.discount)}</p>
        ) : null}
        <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-sm text-[#6A6A6A]">
          {order.shipping > 0 ? `Frete ${formatBRL(order.shipping)}` : "Frete grátis"}
          {order.shippingMethod === "full" ? <MercadoFullBadge className="h-4" /> : null} ·{" "}
          {order.shippingMethod === "full" ? "3 a 5 dias úteis" : "5 a 8 dias úteis"}
        </p>
        <p className="mt-4 text-sm text-[#6A6A6A]">
          Entrega em {order.customer.street}, {order.customer.number} — {order.customer.city}/{order.customer.state}
        </p>
        {extras.length > 0 ? (
          <ul className="mt-6 divide-y divide-white/10 border-t border-white/10 text-left">
            {extras.flatMap((child) =>
              child.items.map((item) => (
                <li key={`${child.id}-${item.id}`} className="flex justify-between py-4">
                  <span>
                    {item.name} <span className="text-[#6A6A6A]">· compra adicional {child.id}</span>
                  </span>
                  <span>{formatBRL(item.price * item.quantity)}</span>
                </li>
              )),
            )}
          </ul>
        ) : null}
        <p className="mt-6 font-display text-2xl font-black">Total pago {formatBRL(order.total + extrasTotal)}</p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/produtos" className="kyt-btn kyt-btn-primary">
            Continuar comprando
          </Link>
          <Link to="/contato" className="kyt-btn kyt-btn-outline">
            Falar com a gente
          </Link>
        </div>
      </div>
    </section>
  );
}
