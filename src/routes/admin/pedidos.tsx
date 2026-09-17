import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { cartContactName, cartItemsLabel, whatsappCartHref } from "@/lib/abandoned";
import { formatBRL, formatDuration } from "@/lib/format";
import { pathLabel } from "@/lib/path-label";
import { readPushcutUrls, storePushcutUrls } from "@/lib/pushcut-urls";
import type { AbandonedCart, LiveSnapshot, StoreOrder, TrackingSettings } from "@/lib/tracking-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/pedidos")({
  component: AdminOrdersPage,
  head: () => ({ meta: [{ title: "Pedidos · Painel KYT" }] }),
});

const CART_STATUS: Record<AbandonedCart["status"], string> = {
  quente: "Quente",
  abandonado: "Abandonado",
  pix: "PIX gerado",
  perdido: "Frio",
};

function AdminOrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [tab, setTab] = useState<"vendas" | "abandonados">("vendas");
  const pushcutFlushed = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [ordersJson, liveJson, trackingJson] = await Promise.all([
        fetch("/api/admin/orders", { credentials: "include", cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin/live", { credentials: "include", cache: "no-store" }).then((res) => res.json()),
        fetch("/api/admin/tracking", { credentials: "include", cache: "no-store" }).then((res) => res.json()).catch(() => ({})),
      ]);
      if (cancelled) return;
      setOrders(((ordersJson as { orders?: StoreOrder[] }).orders ?? []));
      setCarts(((liveJson as LiveSnapshot).carts ?? []));
      const tracking = (trackingJson as { tracking?: TrackingSettings }).tracking;
      if (tracking?.pushcut) storePushcutUrls(tracking.pushcut.pendingUrl, tracking.pushcut.paidUrl);
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const listedOrders = useMemo(() => {
    const byId = new Map<string, StoreOrder>();
    for (const order of orders) byId.set(order.id, order);
    for (const cart of carts) {
      const id = cart.orderId.trim();
      if (!id || byId.has(id)) continue;
      byId.set(id, {
        id,
        createdAt: cart.startedAt,
        items: cart.cartItems.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.name,
          color: item.color,
          size: item.size,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
        })),
        customer: {
          name: cart.customerName,
          email: cart.customerEmail,
          phone: cart.customerPhone,
          cpf: "",
          cep: "",
          street: "",
          number: "",
          complement: "",
          neighborhood: "",
          city: "",
          state: "",
          payment: "pix",
        },
        subtotal: cart.cartValue,
        shipping: 0,
        shippingMethod: "gratis",
        total: cart.cartValue,
        discount: 0,
        paymentStatus: cart.paymentStatus === "paid" ? "paid" : cart.paymentStatus === "failed" ? "failed" : "pending",
        eventId: `live_${id}`,
        attribution: {
          fbp: "",
          fbc: "",
          fbclid: "",
          ttclid: "",
          ttp: "",
          gclid: "",
          gbraid: "",
          wbraid: "",
          clientId: cart.clientId,
          utmSource: "",
          utmMedium: "",
        },
        userAgent: cart.userAgent,
        ip: cart.ip,
        purchaseSent: false,
      });
    }
    return [...byId.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [orders, carts]);

  const abandonedValue = useMemo(() => carts.reduce((sum, cart) => sum + cart.cartValue, 0), [carts]);
  const pendingValue = useMemo(
    () => listedOrders.filter((order) => order.paymentStatus === "pending").reduce((sum, order) => sum + order.total, 0),
    [listedOrders],
  );

  useEffect(() => {
    const urls = readPushcutUrls();
    if (!urls.pendingUrl && !urls.paidUrl) return;
    for (const order of listedOrders) {
      if (order.paymentStatus === "failed") continue;
      const kinds: Array<"pending" | "paid"> = [];
      if (order.paymentStatus === "pending" && !order.pushcutPendingSent) kinds.push("pending");
      if (order.paymentStatus === "paid") {
        if (!order.pushcutPendingSent) kinds.push("pending");
        if (!order.pushcutPaidSent) kinds.push("paid");
      }
      for (const kind of kinds) {
        const key = `${order.id}:${kind}`;
        if (pushcutFlushed.current.has(key)) continue;
        pushcutFlushed.current.add(key);
        void fetch("/api/admin/pushcut-order", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            kind,
            order,
            pendingUrl: urls.pendingUrl,
            paidUrl: urls.paidUrl,
          }),
        }).catch(() => {
          pushcutFlushed.current.delete(key);
        });
      }
    }
  }, [listedOrders]);

  return (
    <div>
      <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">Pedidos</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Vendas e abandono</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6A6A6A]">
        {formatBRL(abandonedValue)} em carrinhos sem pagar · {formatBRL(pendingValue)} em PIX/cartão pendente.
      </p>

      <div className="mt-6 flex flex-wrap gap-1">
        {(
          [
            { key: "vendas", label: `Pedidos (${listedOrders.length})` },
            { key: "abandonados", label: `Abandonados (${carts.length})` },
          ] as const
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "px-3 py-1.5 font-display text-xs font-bold uppercase",
              tab === item.key ? "bg-[#CC2222] text-white" : "border border-white/10 text-[#6A6A6A] hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "abandonados" ? <AbandonedTable carts={carts} /> : <OrdersTable orders={listedOrders} />}
    </div>
  );
}

function AbandonedTable({ carts }: { carts: AbandonedCart[] }) {
  return (
    <div className="mt-8 overflow-x-auto border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#0c0c10] text-xs tracking-wide text-[#6A6A6A] uppercase">
          <tr>
            <th className="px-4 py-3">Pedido</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Itens</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Parado</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Contato</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {carts.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-[#6A6A6A]">
                Nenhum carrinho abandonado ainda. Eles ficam salvos e não expiram.
              </td>
            </tr>
          ) : (
            carts.map((cart) => {
              const whatsapp = whatsappCartHref(cart);
              return (
                <tr key={cart.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-display font-bold">{cart.orderId || "Carrinho"}</p>
                    <p className="text-xs text-[#6A6A6A]">{pathLabel(cart.path)} · {cart.source === "meta" ? "Meta" : cart.source === "tiktok" ? "TikTok" : cart.source === "google" ? "Google" : cart.source === "direct" ? "Direto" : "Outro"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{cartContactName(cart)}</p>
                    <p className="text-xs text-[#6A6A6A]">{cart.customerEmail || "sem e-mail"}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#B8B8B8]">
                    {cart.cartItems.length ? (
                      cart.cartItems.map((item) => (
                        <p key={item.id}>
                          {item.name}
                          {item.color ? ` · ${item.color}` : ""}
                          {item.size ? ` · ${item.size}` : ""} ×{item.quantity}
                        </p>
                      ))
                    ) : (
                      <p>{cartItemsLabel(cart.cartItems)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 font-display font-bold">{formatBRL(cart.cartValue)}</td>
                  <td className="px-4 py-3">
                    <p>{formatDuration(cart.idleMs)}</p>
                    <p className="text-xs text-[#6A6A6A]">{cart.device === "mobile" ? "Mobile" : "Desktop"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[11px] font-bold tracking-widest text-amber-400 uppercase">{CART_STATUS[cart.status]}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <p className="text-[#6A6A6A]">{cart.customerPhone || "sem telefone"}</p>
                    {whatsapp ? (
                      <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-emerald-400 uppercase">
                        WhatsApp
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ orders }: { orders: StoreOrder[] }) {
  return (
    <div className="mt-8 overflow-x-auto border border-white/10">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#0c0c10] text-xs tracking-wide text-[#6A6A6A] uppercase">
          <tr>
            <th className="px-4 py-3">Pedido</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Itens</th>
            <th className="px-4 py-3">Pagamento</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-[#6A6A6A]">
                Nenhum pedido registrado neste servidor ainda.
              </td>
            </tr>
          ) : (
            orders.map((order) => (
              <tr key={order.id} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-display font-bold">{order.id}</p>
                  <p className="text-xs text-[#6A6A6A]">{new Date(order.createdAt).toLocaleString("pt-BR")}</p>
                </td>
                <td className="px-4 py-3">
                  <p>{order.customer.name}</p>
                  <p className="text-xs text-[#6A6A6A]">{order.customer.email}</p>
                  <p className="text-xs text-[#6A6A6A]">
                    {order.customer.city}/{order.customer.state}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs text-[#B8B8B8]">
                  {order.items.map((item) => (
                    <p key={item.id}>
                      {item.name} · {item.color} · {item.size} ×{item.quantity}
                    </p>
                  ))}
                </td>
                <td className="px-4 py-3">{order.customer.payment === "pix" ? "PIX" : "Cartão"}</td>
                <td className="px-4 py-3">{formatBRL(order.total)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.paymentStatus} />
                  {order.paymentStatus === "failed" && order.errorMessage ? (
                    <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-[#CC2222]">{order.errorMessage}</p>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
