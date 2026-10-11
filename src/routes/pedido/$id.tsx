import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useCart, type Order, type PaymentStatus } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { checkPayinStatus } from "@/lib/payin-client";
import { getAttribution } from "@/lib/pixel-client";

export const Route = createFileRoute("/pedido/$id")({
  head: () => ({ meta: [{ title: "Pedido | KYT Capacetes Brasil" }, { name: "robots", content: "noindex" }] }),
  component: OrderPage,
});

/** O PIX vence em 30 minutos (mesmo prazo informado no checkout). */
const EXPIRES_MS = 30 * 60 * 1000;

function OrderPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { getOrder, updateOrderPayment, hydrated, restoreOrderToCart } = useCart();
  const [order, setOrder] = useState<Order | undefined>();
  const [status, setStatus] = useState<PaymentStatus>("pending");

  useEffect(() => {
    if (!hydrated) return;
    const found = getOrder(id);
    setOrder(found);
    if (found) setStatus(found.paymentStatus);
  }, [getOrder, hydrated, id]);

  // Consulta o gateway a cada 4 s; o servidor decide o que é "pago".
  useEffect(() => {
    if (!order || status !== "pending") return;
    const tx = order.transactionId ?? "";
    const ref = order.referenceId ?? "";
    if (!tx && !ref) return;
    let cancelled = false;
    async function poll() {
      try {
        // Envia o pedido junto: se o servidor que responder não o tiver salvo, ainda consegue avisar as plataformas.
        const snapshot = order ? { ...order, attribution: getAttribution(), userAgent: navigator.userAgent } : undefined;
        const remote = await checkPayinStatus(tx, ref, order?.paymentGateway, snapshot);
        if (cancelled) return;
        if (remote === "paid" || remote === "failed") {
          updateOrderPayment(id, remote);
          setStatus(remote);
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
  }, [id, order, status, updateOrderPayment]);

  // Pago: pedido principal vai para as ofertas; cobrança extra volta ao obrigado do pedido principal.
  useEffect(() => {
    if (status !== "paid" || !order) return;
    if (order.parentOrderId) void navigate({ to: "/obrigado/$id", params: { id: order.parentOrderId }, replace: true });
    else void navigate({ to: "/upsell/$id", params: { id: order.id }, replace: true });
  }, [status, order, navigate]);

  if (!hydrated) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#CC2222]" />
      </div>
    );
  }

  if (!order) {
    return (
      <section className="py-20 text-center">
        <h1 className="font-display text-4xl font-black uppercase">Pedido não encontrado</h1>
        <p className="mt-3 text-sm text-[#6A6A6A]">Este pedido não está salvo neste aparelho.</p>
        <Link to="/produtos" className="kyt-btn kyt-btn-primary mt-6">
          Ir para a loja
        </Link>
      </section>
    );
  }

  if (status === "paid") {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (status === "failed") {
    return (
      <Refused
        order={order}
        onRetry={() => {
          restoreOrderToCart(order);
          void navigate({ to: "/checkout" });
        }}
      />
    );
  }

  if (order.customer.payment === "card") {
    return (
      <section className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <Pill variant="waiting" />
        <h1 className="mt-6 font-display text-4xl font-black uppercase">Confirmando com o banco</h1>
        <p className="mt-3 text-sm text-[#A0A0A0]">
          Pagamento no cartão final {order.customer.cardLast4 ?? "****"} em análise. Esta página atualiza sozinha.
        </p>
      </section>
    );
  }

  return (
    <WaitingPix
      order={order}
      onExpired={() => {
        restoreOrderToCart(order);
        void navigate({ to: "/checkout" });
      }}
    />
  );
}

function WaitingPix({ order, onExpired }: { order: Order; onExpired: () => void }) {
  const [copied, setCopied] = useState(false);
  // null no servidor e na primeira renderização (evita diferença de hidratação na contagem).
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const createdAt = Date.parse(order.createdAt) || Date.now();
  const remaining = useMemo(() => (now === null ? EXPIRES_MS : Math.max(0, EXPIRES_MS - (now - createdAt))), [now, createdAt]);
  const expired = now !== null && remaining === 0;
  const mmss = `${String(Math.floor(remaining / 60000)).padStart(2, "0")}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`;

  async function copy() {
    if (!order.pix?.code) return;
    try {
      await navigator.clipboard.writeText(order.pix.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  if (!order.pix?.code) {
    return (
      <section className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-black uppercase text-[#CC2222]">PIX não gerado</h1>
        <p className="mt-3 text-sm text-[#A0A0A0]">O código não chegou. Volte ao checkout e gere o pagamento de novo.</p>
        <button type="button" onClick={onExpired} className="kyt-btn kyt-btn-primary mt-6">
          Gerar PIX novamente
        </button>
      </section>
    );
  }

  if (expired) {
    return (
      <section className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-black uppercase">Este PIX expirou</h1>
        <p className="mt-3 text-sm text-[#A0A0A0]">
          O código venceu antes do pagamento. Gere um novo PIX para concluir o pedido. Se você já pagou, fale com a gente que confirmamos na hora.
        </p>
        <button type="button" onClick={onExpired} className="kyt-btn kyt-btn-primary mt-6">
          Gerar novo PIX
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-[560px] px-4 pt-8 pb-16 text-center">
      <h1 className="font-display text-4xl font-black uppercase">Quase lá...</h1>
      <p className="mt-2 text-sm text-[#A0A0A0]">
        Pague o PIX em até <b className="font-display text-base text-[#F0F0F0]">{mmss}</b> para confirmar seu pedido.
      </p>
      <div className="mt-4">
        <Pill variant="waiting" />
      </div>

      {order.pix.image ? (
        <img src={order.pix.image} alt="QR Code PIX" className="mx-auto mt-6 h-52 w-52 bg-white object-contain p-2" />
      ) : null}

      <p className="mt-5 text-sm text-[#A0A0A0]">
        Total no PIX: <b className="font-display text-xl text-emerald-400">{formatBRL(order.total)}</b>
      </p>
      <div className="mt-4 break-all border border-white/10 bg-[#111] px-4 py-3 text-left text-xs text-[#A0A0A0]">{order.pix.code}</div>
      <button type="button" onClick={() => void copy()} className="kyt-btn kyt-btn-primary mt-3 w-full">
        <Copy className="h-4 w-4" /> {copied ? "Código copiado!" : "Copiar código PIX"}
      </button>

      <div className="mt-10 text-left">
        <h2 className="font-display text-xl font-black uppercase">Como pagar o PIX</h2>
        <ol className="mt-4 space-y-4">
          {[
            <>
              Clique em <b>Copiar código PIX</b>, logo acima (ou leia o QR Code)
            </>,
            <>
              Abra o <b>aplicativo</b> do seu banco
            </>,
            <>
              Selecione a opção <b>PIX</b>
            </>,
            <>
              Toque em <b>“Pix Copia e Cola”</b>
            </>,
            <>Cole o código e finalize o pagamento. Esta página confirma sozinha.</>,
          ].map((text, index) => (
            <li key={index} className="flex items-center gap-3 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-[#CC2222] font-display text-sm font-black text-white">{index + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-8 text-xs text-[#6A6A6A]">Pedido {order.id}</p>
    </section>
  );
}

function Refused({ order, onRetry }: { order: Order; onRetry: () => void }) {
  return (
    <section className="mx-auto max-w-[560px] px-4 py-16 text-center">
      <Pill variant="refused" />
      <h1 className="mt-6 font-display text-3xl font-black uppercase">Pagamento não aprovado</h1>
      <p className="mt-3 text-sm text-[#A0A0A0]">
        {order.errorMessage || "Confira os dados informados e tente novamente."}
      </p>
      <button type="button" onClick={onRetry} className="kyt-btn kyt-btn-primary mt-6">
        Tentar novamente
      </button>
    </section>
  );
}

export function Pill({ variant }: { variant: "waiting" | "approved" | "refused" }) {
  const map = {
    waiting: { text: "Aguardando pagamento", cls: "bg-amber-400/15 text-amber-300" },
    approved: { text: "Aprovado", cls: "bg-emerald-500/15 text-emerald-400" },
    refused: { text: "Pagamento não aprovado", cls: "bg-[#CC2222]/15 text-[#FF6B6B]" },
  } as const;
  const value = map[variant];
  return <span className={`inline-block px-5 py-2 font-display text-xs font-black tracking-[0.14em] uppercase ${value.cls}`}>{value.text}</span>;
}
