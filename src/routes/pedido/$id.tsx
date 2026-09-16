import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { MercadoFullBadge } from "@/components/checkout/MercadoFullBadge";
import { useCart, type Order, type PaymentStatus } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { checkPayinStatus } from "@/lib/payin-client";
import { shippingLabel } from "@/lib/shipping";


export const Route = createFileRoute("/pedido/$id")({
  head: () => ({ meta: [{ title: "Pedido | KYT Capacetes Brasil" }] }),
  component: OrderPage,
});

function statusLabel(status: PaymentStatus) {
  if (status === "paid") return "Pagamento confirmado";
  if (status === "failed") return "Pagamento não concluído";
  return "Aguardando pagamento";
}

function OrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { getOrder, updateOrderPayment, hydrated } = useCart();
  const [order, setOrder] = useState<Order | undefined>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setOrder(getOrder(id));
  }, [getOrder, hydrated, id]);

  useEffect(() => {
    if (!order || order.paymentStatus !== "pending") return;
    const tx = order.transactionId ?? "";
    const ref = order.referenceId ?? "";
    if (!tx && !ref) return;

    let cancelled = false;
    async function poll() {
      try {
        const status = await checkPayinStatus(tx, ref);
        if (cancelled) return;
        if (status === "paid" || status === "failed") {
          updateOrderPayment(id, status);
          setOrder((current) => (current ? { ...current, paymentStatus: status } : current));
          if (status === "paid") {
            void navigate({ to: "/obrigado/$id", params: { id } });
          }
        }
      } catch {
        // Keep waiting; webhook/status can catch up later.
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id, navigate, order, updateOrderPayment]);


  if (!hydrated) {
    return (
      <section className="pt-28 pb-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Pedido</h1>
        <p className="mt-4 text-[#6A6A6A]">Carregando...</p>
      </section>
    );
  }

  if (!order) {
    return (
      <section className="pt-28 pb-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Pedido não encontrado</h1>
        <Link to="/produtos" className="kyt-btn kyt-btn-primary mt-6">
          Ir para a loja
        </Link>
      </section>
    );
  }

  const firstName = order.customer.name.split(" ")[0] ?? "";
  const pixPending = order.customer.payment === "pix" && order.paymentStatus === "pending";

  async function copyPix() {
    if (!order?.pix?.code) return;
    try {
      await navigator.clipboard.writeText(order.pix.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto max-w-3xl px-6 text-center lg:px-10">
        <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">
          {statusLabel(order.paymentStatus)}
        </p>
        <h1 className="mt-4 font-display text-5xl font-black uppercase">
          {order.paymentStatus === "failed" ? "Não foi possível concluir" : `Obrigado, ${firstName}`}
        </h1>
        <p className="mt-4 text-[#6A6A6A]">
          Pedido <span className="text-white">{order.id}</span>
          {order.paymentStatus === "paid"
            ? `. Enviamos os detalhes para ${order.customer.email}.`
            : order.paymentStatus === "failed"
              ? ". Tente novamente com outro meio de pagamento."
              : order.customer.payment === "pix"
                ? ". Pague o PIX abaixo para confirmar o pedido."
                : ". Estamos confirmando o pagamento com o banco."}
        </p>

        {pixPending && order.pix ? (
          <div className="mx-auto mt-8 max-w-sm border border-white/10 bg-[#111] p-6">
            <p className="font-display text-sm font-bold tracking-widest uppercase">PIX · 10% OFF</p>
            {order.pix.image ? (
              <img src={order.pix.image} alt="QR Code PIX" className="mx-auto mt-4 h-48 w-48 bg-white object-contain p-2" />
            ) : (
              <div className="mx-auto mt-4 flex h-40 w-40 items-center justify-center bg-white text-[#080808]">
                <span className="font-display text-3xl font-black">PIX</span>
              </div>
            )}
            <p className="mt-4 text-sm text-[#6A6A6A]">Pague {formatBRL(order.total)} para concluir o pedido.</p>
            <button type="button" onClick={() => void copyPix()} className="kyt-btn kyt-btn-outline mt-4 w-full">
              {copied ? "Código copiado" : "Copiar código PIX"}
            </button>
          </div>
        ) : null}

        {order.customer.payment === "card" && order.paymentStatus === "pending" ? (
          <p className="mt-6 text-sm text-[#6A6A6A]">
            Pagamento no cartão final {order.customer.cardLast4 ?? "****"} em análise. Esta página atualiza sozinha.
          </p>
        ) : null}

        {order.customer.payment === "card" && order.paymentStatus === "paid" ? (
          <p className="mt-6 text-sm text-[#6A6A6A]">
            Pagamento no cartão final {order.customer.cardLast4 ?? "****"} confirmado
            {order.installments ? ` em ${order.installments}x` : ""}.
          </p>
        ) : null}

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
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-[#6A6A6A]">
          {order.shippingMethod === "full" ? <MercadoFullBadge className="h-5" /> : null}
          {order.shipping > 0
            ? `Frete ${formatBRL(order.shipping)} · ${shippingLabel(order.shippingMethod)}`
            : shippingLabel(order.shippingMethod ?? "gratis")}
        </p>
        <p className="mt-4 text-sm text-[#6A6A6A]">
          Entrega em {order.customer.street}, {order.customer.number} — {order.customer.city}/{order.customer.state}
        </p>
        <p className="mt-6 font-display text-2xl font-black">Total {formatBRL(order.total)}</p>
        <Link to="/" className="kyt-btn kyt-btn-primary mt-8">
          Voltar ao início
        </Link>
      </div>
    </section>
  );
}
