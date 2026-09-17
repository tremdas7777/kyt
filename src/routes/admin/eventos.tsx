import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { adminJson } from "@/lib/admin-fetch";
import type { TrackingLog } from "@/lib/tracking-types";

export const Route = createFileRoute("/admin/eventos")({
  component: AdminEventsPage,
  head: () => ({ meta: [{ title: "Eventos · Painel KYT" }] }),
});

function AdminEventsPage() {
  const [events, setEvents] = useState<TrackingLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const json = await adminJson<{ events?: TrackingLog[] }>("/api/admin/events", {}, 10000);
      if (!cancelled) setEvents(json?.events ?? []);
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
      <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">Rastreio</p>
      <h1 className="mt-2 font-display text-4xl font-black uppercase">Eventos</h1>
      <p className="mt-2 max-w-2xl text-sm text-[#6A6A6A]">
        Log do pixel no servidor (CAPI, TikTok Events API, GA4 MP). O navegador dispara o mesmo event_id para deduplicar.
      </p>
      <div className="mt-8 overflow-x-auto border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#0c0c10] text-xs tracking-wide text-[#6A6A6A] uppercase">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Evento</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Event ID</th>
              <th className="px-4 py-3">Pedido</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[#6A6A6A]">
                  Nenhum evento ainda.
                </td>
              </tr>
            ) : (
              events.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3 text-xs text-[#6A6A6A]">{new Date(event.at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 font-display font-bold uppercase">{event.event}</td>
                  <td className="px-4 py-3">{event.source}</td>
                  <td className="px-4 py-3 font-mono text-xs">{event.eventId}</td>
                  <td className="px-4 py-3 text-xs">{event.orderId || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={event.ok ? "text-emerald-400" : "text-[#CC2222]"}>{event.ok ? "ok" : "falhou"}</span>
                    {event.detail ? <p className="max-w-xs truncate text-[11px] text-[#6A6A6A]">{event.detail}</p> : null}
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
