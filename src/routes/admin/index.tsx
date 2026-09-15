import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatBRL } from "@/lib/format";
import type { StoreOrder, TrackingLog } from "@/lib/tracking-types";

export const Route = createFileRoute("/admin/")({
  component: AdminHomePage,
  head: () => ({ meta: [{ title: "Painel · KYT" }] }),
});

type Dashboard = {
  stats: {
    orders: number;
    paid: number;
    pending: number;
    revenue: number;
    revenueToday: number;
    todayPaid: number;
    pixels: { tiktok: boolean; meta: boolean; google: boolean; capi: boolean; tiktokApi: boolean };
  };
  recentOrders: StoreOrder[];
  recentEvents: TrackingLog[];
};

function AdminHomePage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    void fetch("/api/admin/dashboard", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setData(json as Dashboard));
  }, []);

  if (!data?.stats) {
    return <p className="text-sm text-[#6A6A6A]">Carregando métricas…</p>;
  }

  const { stats } = data;
  const cards = [
    { label: "Faturamento pago", value: formatBRL(stats.revenue) },
    { label: "Pago hoje", value: formatBRL(stats.revenueToday) },
    { label: "Pedidos pagos", value: String(stats.paid) },
    { label: "PIX / cartão pendente", value: String(stats.pending) },
  ];

  return (
    <div>
      <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">Painel</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Operação da loja</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6A6A6A]">
        Pedidos, pixels e eventos no mesmo lugar. O rastreio dispara no navegador e no servidor, com o mesmo event_id.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="border border-white/10 bg-[#0c0c10] p-5">
            <p className="text-xs tracking-wide text-[#6A6A6A] uppercase">{card.label}</p>
            <p className="mt-3 font-display text-3xl font-black">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <PixelStatus label="TikTok Pixel" on={stats.pixels.tiktok} extra={stats.pixels.tiktokApi ? "Events API" : "sem API"} />
        <PixelStatus label="Meta Pixel" on={stats.pixels.meta} extra={stats.pixels.capi ? "CAPI" : "sem CAPI"} />
        <PixelStatus label="Google" on={stats.pixels.google} extra="GA4 / Ads" />
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase">Pedidos recentes</h2>
            <Link to="/admin/pedidos" className="text-xs text-[#CC2222]">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-white/10 border border-white/10">
            {data.recentOrders.length === 0 ? (
              <p className="p-5 text-sm text-[#6A6A6A]">Nenhum pedido ainda.</p>
            ) : (
              data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-display text-sm font-bold uppercase">{order.id}</p>
                    <p className="text-xs text-[#6A6A6A]">
                      {order.customer.name} · {order.customer.payment === "pix" ? "PIX" : "Cartão"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{formatBRL(order.total)}</p>
                    <StatusBadge status={order.paymentStatus} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase">Eventos de rastreio</h2>
            <Link to="/admin/eventos" className="text-xs text-[#CC2222]">
              Ver todos
            </Link>
          </div>
          <div className="divide-y divide-white/10 border border-white/10">
            {data.recentEvents.length === 0 ? (
              <p className="p-5 text-sm text-[#6A6A6A]">Sem eventos ainda. Configure os pixels em Integrações.</p>
            ) : (
              data.recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-display text-sm font-bold uppercase">{event.event}</p>
                    <p className="text-xs text-[#6A6A6A]">
                      {event.source} · {event.eventId.slice(0, 18)}
                    </p>
                  </div>
                  <span className={event.ok ? "text-xs text-emerald-400" : "text-xs text-[#CC2222]"}>
                    {event.ok ? "ok" : "falhou"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PixelStatus({ label, on, extra }: { label: string; on: boolean; extra: string }) {
  return (
    <div className="flex items-center justify-between border border-white/10 bg-[#0c0c10] px-5 py-4">
      <div>
        <p className="font-display text-sm font-bold uppercase">{label}</p>
        <p className="text-xs text-[#6A6A6A]">{extra}</p>
      </div>
      <span className={on ? "text-xs font-bold tracking-widest text-emerald-400 uppercase" : "text-xs text-[#6A6A6A] uppercase"}>
        {on ? "Ativo" : "Off"}
      </span>
    </div>
  );
}

