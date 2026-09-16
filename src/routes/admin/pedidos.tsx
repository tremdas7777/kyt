import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatBRL } from "@/lib/format";
import type { StoreOrder } from "@/lib/tracking-types";

export const Route = createFileRoute("/admin/pedidos")({
  component: AdminOrdersPage,
  head: () => ({ meta: [{ title: "Pedidos · Painel KYT" }] }),
});

function AdminOrdersPage() {
  const [orders, setOrders] = useState<StoreOrder[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const json = await fetch("/api/admin/orders", { credentials: "include", cache: "no-store" }).then((res) => res.json());
      if (!cancelled) setOrders(((json as { orders?: StoreOrder[] }).orders ?? []));
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div>
      <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">Pedidos</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Vendas da loja</h1>
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
