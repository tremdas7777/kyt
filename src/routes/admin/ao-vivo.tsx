import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { formatBRL, formatDuration, formatRelativeTime } from "@/lib/format";
import { pathLabel } from "@/lib/path-label";
import type {
  AbandonedCart,
  AbandonedProduct,
  CartStatusBucket,
  FunnelWindow,
  LiveSnapshot,
  LiveVisitor,
  SourceFunnels,
  TrafficSource,
} from "@/lib/tracking-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/ao-vivo")({
  component: LiveOpsPage,
  head: () => ({ meta: [{ title: "Ao vivo · Painel KYT" }] }),
});

const SOURCE_LABEL: Record<TrafficSource, string> = {
  tiktok: "TikTok",
  meta: "Meta",
  google: "Google",
  direct: "Direto",
  other: "Outro",
};

const SOURCE_CLASS: Record<TrafficSource, string> = {
  tiktok: "bg-[#fe2c55]/15 text-[#fe2c55]",
  meta: "bg-[#1877f2]/15 text-[#4ea3ff]",
  google: "bg-[#34a853]/15 text-[#3ddc84]",
  direct: "bg-white/10 text-[#B8B8B8]",
  other: "bg-white/10 text-[#B8B8B8]",
};

const STAGE_LABEL: Record<LiveVisitor["stage"], string> = {
  home: "Início",
  listing: "Catálogo",
  product: "Produto",
  cart: "Carrinho",
  checkout: "Checkout",
  payment: "Pagando",
  paid: "Pago",
};

const STATUS_LABEL: Record<AbandonedCart["status"], string> = {
  quente: "Quente",
  abandonado: "Abandonado",
  pix: "Aguardando PIX",
  perdido: "Frio",
};

const FUNNEL_STEPS = [
  { key: "visit", label: "Visita" },
  { key: "product", label: "Produto" },
  { key: "cart", label: "Carrinho" },
  { key: "checkout", label: "Checkout" },
  { key: "purchase", label: "Compra" },
] as const;

function LiveOpsPage() {
  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [windowKey, setWindowKey] = useState<"today" | "week" | "month">("today");
  const [filter, setFilter] = useState<"todos" | AbandonedCart["status"]>("todos");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch("/api/admin/live", { credentials: "include", cache: "no-store" });
      const json = (await response.json()) as LiveSnapshot & { ok?: boolean };
      if (!cancelled && json.ok !== false) setData(json);
    }
    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const funnel = data?.funnel[windowKey];
  const sourceFunnels = data?.sourceFunnels[windowKey];
  const carts = useMemo(() => {
    const list = data?.carts ?? [];
    if (filter === "todos") return list;
    return list.filter((cart) => cart.status === filter);
  }, [data, filter]);

  const stageMix = useMemo(() => {
    const counts: Record<LiveVisitor["stage"], number> = {
      home: 0,
      listing: 0,
      product: 0,
      cart: 0,
      checkout: 0,
      payment: 0,
      paid: 0,
    };
    for (const visitor of data?.online ?? []) counts[visitor.stage] += 1;
    return counts;
  }, [data]);

  if (!data || !funnel || !sourceFunnels) {
    return <p className="text-sm text-[#6A6A6A]">Ligando o ao vivo…</p>;
  }

  const leak = biggestLeak(funnel);
  const riskValue = data.cartStatus.abandonado.value + data.cartStatus.pix.value + data.cartStatus.perdido.value;
  const recoverable = data.cartStatus.quente.value;
  const kpis = [
    { label: "Online agora", value: String(data.onlineCount), hint: "últimos 90s" },
    { label: "No checkout", value: String(data.inCheckout), hint: "pagamento aberto" },
    { label: "Carrinhos ativos", value: String(data.activeCarts), hint: "com item, na loja" },
    { label: "Abandonados hoje", value: String(data.abandonedToday), hint: formatBRL(data.abandonedValueToday) },
    { label: "Conversão", value: pct(data.conversionToday), hint: `${funnel.purchase} compras / ${funnel.visit} sessões` },
    { label: "Aguardando PIX", value: String(data.awaitingPix), hint: "pedido gerado" },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            Ao vivo
          </p>
          <h1 className="mt-2 font-display text-4xl font-black uppercase">Operação em tempo real</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6A6A6A]">
            Quem está na loja agora, onde o funil perde gente e quais capacetes ficaram no carrinho. Atualiza a cada 4
            segundos.
          </p>
        </div>
        <p className="text-xs text-[#6A6A6A]">Atualizado {formatRelativeTime(data.generatedAt)}</p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="border border-white/10 bg-[#0c0c10] p-4">
            <p className="text-[11px] tracking-wide text-[#6A6A6A] uppercase">{kpi.label}</p>
            <p className="mt-2 font-display text-3xl font-black">{kpi.value}</p>
            <p className="mt-1 text-xs text-[#6A6A6A]">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(SOURCE_LABEL) as TrafficSource[]).map((source) => (
          <span key={source} className={cn("rounded-full px-3 py-1 text-xs font-bold uppercase", SOURCE_CLASS[source])}>
            {SOURCE_LABEL[source]} · {data.sources[source]}
          </span>
        ))}
      </div>

      <section className="mt-10 border border-white/10 bg-[#0c0c10] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold uppercase">Análise do funil</h2>
            <p className="mt-1 text-sm text-[#B8B8B8]">
              {funnelInsight(funnel, leak)} Receita no período: {formatBRL(funnel.revenue)}.
            </p>
          </div>
          <div className="flex gap-1">
            {(
              [
                ["today", "Hoje"],
                ["week", "7 dias"],
                ["month", "30 dias"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setWindowKey(key)}
                className={cn(
                  "px-3 py-1.5 font-display text-xs font-bold uppercase",
                  windowKey === key ? "bg-[#CC2222] text-white" : "text-[#6A6A6A] hover:text-white",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <FunnelBars funnel={funnel} leakIndex={leak.index} />
        <SourceFunnelTable funnels={sourceFunnels} />
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-2">
        <section>
          <h2 className="mb-4 font-display text-lg font-bold uppercase">Quem está na loja</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(STAGE_LABEL) as LiveVisitor["stage"][]).map((stage) =>
              stageMix[stage] ? (
                <span key={stage} className="border border-white/10 px-2 py-1 text-[11px] uppercase text-[#B8B8B8]">
                  {STAGE_LABEL[stage]} · {stageMix[stage]}
                </span>
              ) : null,
            )}
          </div>
          <div className="divide-y divide-white/10 border border-white/10">
            {data.online.length === 0 ? (
              <p className="p-6 text-sm text-[#6A6A6A]">Ninguém online neste instante. Abra a loja em outra aba para ver o pulso.</p>
            ) : (
              data.online.map((visitor) => <VisitorRow key={visitor.id} visitor={visitor} />)
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-bold uppercase">Páginas agora</h2>
          <div className="divide-y divide-white/10 border border-white/10">
            {data.pages.length === 0 ? (
              <p className="p-6 text-sm text-[#6A6A6A]">Sem páginas ativas.</p>
            ) : (
              data.pages.map((page) => (
                <div key={page.path} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-display text-sm font-bold uppercase">{pathLabel(page.path)}</p>
                    <p className="text-xs text-[#6A6A6A]">{page.path}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-black">{page.count}</p>
                    {page.cartValue > 0 ? <p className="text-xs text-[#6A6A6A]">{formatBRL(page.cartValue)}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-10 border border-white/10 bg-[#0c0c10] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold uppercase">Carrinho abandonado</h2>
            <p className="mt-1 text-sm text-[#B8B8B8]">
              {formatBRL(recoverable)} ainda recuperável · {formatBRL(riskValue)} em risco (abandonado, PIX e frio).
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(STATUS_LABEL) as AbandonedCart["status"][]).map((status) => (
            <StatusSummary key={status} status={status} bucket={data.cartStatus[status]} active={filter === status} onClick={() => setFilter(status)} />
          ))}
        </div>
        <AbandonedProducts products={data.topAbandoned} />
      </section>

      <div className="mt-10 grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold uppercase">Fila de recuperação</h2>
            <div className="flex flex-wrap gap-1">
              {(["todos", "quente", "abandonado", "pix", "perdido"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-bold uppercase",
                    filter === key ? "bg-white text-[#080808]" : "text-[#6A6A6A] hover:text-white",
                  )}
                >
                  {key === "todos" ? "Todos" : STATUS_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/10 border border-white/10">
            {carts.length === 0 ? (
              <p className="p-6 text-sm text-[#6A6A6A]">Nenhum carrinho neste filtro.</p>
            ) : (
              carts.slice(0, 12).map((cart) => <CartRow key={cart.id} cart={cart} />)
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-bold uppercase">Abandono detalhado</h2>
          <div className="overflow-x-auto border border-white/10">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#0c0c10] text-xs tracking-wide text-[#6A6A6A] uppercase">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Origem</th>
                  <th className="px-4 py-3">Itens</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Parado</th>
                  <th className="px-4 py-3">Contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {carts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[#6A6A6A]">
                      Sem carrinhos para listar. Adicione um capacete na loja para ver o abandono entrar aqui.
                    </td>
                  </tr>
                ) : (
                  carts.map((cart) => (
                    <tr key={`tbl-${cart.id}`} className="align-top">
                      <td className="px-4 py-3">
                        <StatusChip status={cart.status} />
                        <p className="mt-1 text-xs text-[#6A6A6A]">{STAGE_LABEL[cart.stage]}</p>
                      </td>
                      <td className="px-4 py-3">
                        <SourceChip source={cart.source} />
                        <p className="mt-1 text-xs text-[#6A6A6A]">{cart.device === "mobile" ? "Mobile" : "Desktop"}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#B8B8B8]">
                        {cart.cartItems.map((item) => (
                          <p key={item.id}>
                            {item.name} {item.color ? `· ${item.color}` : ""} {item.size ? `· ${item.size}` : ""} ×
                            {item.quantity}
                          </p>
                        ))}
                      </td>
                      <td className="px-4 py-3 font-display font-bold">{formatBRL(cart.cartValue)}</td>
                      <td className="px-4 py-3">
                        <p>{formatDuration(cart.idleMs)}</p>
                        <p className="text-xs text-[#6A6A6A]">{pathLabel(cart.path)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {cart.customerName || cart.customerEmail || cart.customerPhone ? (
                          <>
                            <p>{cart.customerName || "—"}</p>
                            <p className="text-[#6A6A6A]">{cart.customerEmail}</p>
                            <p className="text-[#6A6A6A]">{cart.customerPhone}</p>
                            {cart.orderId ? <p className="mt-1 text-[#6A6A6A]">{cart.orderId}</p> : null}
                          </>
                        ) : (
                          <p className="text-[#6A6A6A]">Ainda anônimo</p>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function FunnelBars({ funnel, leakIndex }: { funnel: FunnelWindow; leakIndex: number }) {
  const steps = FUNNEL_STEPS.map((step) => ({ ...step, value: funnel[step.key] }));
  const max = Math.max(funnel.visit, 1);
  return (
    <div className="mt-6 grid grid-cols-5 gap-2 md:gap-4">
      {steps.map((step, index) => {
        const prev = index === 0 ? step.value : (steps[index - 1]?.value ?? 0);
        const rate = prev > 0 ? step.value / prev : 0;
        const drop = index === 0 ? 0 : Math.max(0, 1 - rate);
        const isLeak = index === leakIndex && drop > 0;
        return (
          <div key={step.key} className={cn(isLeak && "outline outline-1 outline-[#CC2222]/60")}>
            <div className="flex h-24 items-end bg-black/40 md:h-36">
              <div className={cn("w-full", isLeak ? "bg-[#CC2222]" : "bg-[#CC2222]/70")} style={{ height: `${Math.max(6, (step.value / max) * 100)}%` }} />
            </div>
            <p className="mt-3 font-display text-2xl font-black">{step.value}</p>
            <p className="text-xs tracking-wide text-[#6A6A6A] uppercase">{step.label}</p>
            {index > 0 ? (
              <p className={cn("mt-1 text-xs", isLeak ? "text-[#CC2222]" : "text-[#B8B8B8]")}>
                {pct(rate)} do passo anterior
                {drop > 0 ? ` · −${pct(drop)}` : ""}
              </p>
            ) : (
              <p className="mt-1 text-xs text-[#6A6A6A]">base do funil</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SourceFunnelTable({ funnels }: { funnels: SourceFunnels }) {
  return (
    <div className="mt-8 overflow-x-auto">
      <p className="mb-3 text-xs tracking-wide text-[#6A6A6A] uppercase">Conversão por origem</p>
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs tracking-wide text-[#6A6A6A] uppercase">
          <tr>
            <th className="py-2 pr-4">Canal</th>
            <th className="py-2 pr-4">Visita</th>
            <th className="py-2 pr-4">Produto</th>
            <th className="py-2 pr-4">Carrinho</th>
            <th className="py-2 pr-4">Checkout</th>
            <th className="py-2 pr-4">Compra</th>
            <th className="py-2">Conv.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {(Object.keys(SOURCE_LABEL) as TrafficSource[]).map((source) => {
            const row = funnels[source];
            if (!row || row.visit === 0) {
              return (
                <tr key={source} className="text-[#6A6A6A]">
                  <td className="py-2 pr-4">
                    <SourceChip source={source} />
                  </td>
                  <td className="py-2 pr-4" colSpan={6}>
                    Sem sessões neste período
                  </td>
                </tr>
              );
            }
            return (
              <tr key={source}>
                <td className="py-2 pr-4">
                  <SourceChip source={source} />
                </td>
                <td className="py-2 pr-4">{row.visit}</td>
                <td className="py-2 pr-4">{row.product}</td>
                <td className="py-2 pr-4">{row.cart}</td>
                <td className="py-2 pr-4">{row.checkout}</td>
                <td className="py-2 pr-4">{row.purchase}</td>
                <td className="py-2 font-display font-bold">{pct(row.visit > 0 ? row.purchase / row.visit : 0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusSummary({
  status,
  bucket,
  active,
  onClick,
}: {
  status: AbandonedCart["status"];
  bucket: CartStatusBucket;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("border p-4 text-left", active ? "border-white bg-white/5" : "border-white/10 hover:border-white/30")}
    >
      <StatusChip status={status} />
      <p className="mt-2 font-display text-2xl font-black">{bucket.count}</p>
      <p className="mt-1 text-xs text-[#6A6A6A]">{formatBRL(bucket.value)}</p>
    </button>
  );
}

function AbandonedProducts({ products }: { products: AbandonedProduct[] }) {
  if (products.length === 0) return null;
  return (
    <div className="mt-6">
      <p className="mb-3 text-xs tracking-wide text-[#6A6A6A] uppercase">Capacetes mais abandonados</p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <div key={product.name} className="flex items-center justify-between border border-white/10 px-3 py-2">
            <p className="text-sm">{product.name}</p>
            <p className="text-xs text-[#6A6A6A]">
              {product.quantity} un · {formatBRL(product.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisitorRow({ visitor }: { visitor: LiveVisitor }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-display text-sm font-bold uppercase">{pathLabel(visitor.path)}</p>
          <SourceChip source={visitor.source} />
          <span className="text-[11px] text-[#6A6A6A] uppercase">{STAGE_LABEL[visitor.stage]}</span>
        </div>
        <p className="mt-1 text-xs text-[#6A6A6A]">
          {visitor.device === "mobile" ? "Mobile" : "Desktop"} · {visitor.pageViews} páginas · na loja há{" "}
          {formatRelativeTime(visitor.startedAt)}
        </p>
        {visitor.cartValue > 0 ? (
          <p className="mt-1 text-xs text-white">
            Carrinho {formatBRL(visitor.cartValue)} · {visitor.cartItems.map((item) => item.name).join(", ")}
          </p>
        ) : null}
      </div>
      <p className="shrink-0 text-xs text-[#6A6A6A]">{formatRelativeTime(visitor.lastAt)}</p>
    </div>
  );
}

function CartRow({ cart }: { cart: AbandonedCart }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <StatusChip status={cart.status} />
          <p className="mt-2 font-display text-sm font-bold uppercase">{formatBRL(cart.cartValue)}</p>
          <p className="mt-1 text-xs text-[#6A6A6A]">
            {cart.cartItems.map((item) => `${item.name} ×${item.quantity}`).join(" · ") || "Sem itens"}
          </p>
        </div>
        <SourceChip source={cart.source} />
      </div>
      <p className="mt-2 text-xs text-[#6A6A6A]">
        {pathLabel(cart.path)} · parado há {formatDuration(cart.idleMs)}
        {cart.customerEmail ? ` · ${cart.customerEmail}` : ""}
      </p>
    </div>
  );
}

function SourceChip({ source }: { source: TrafficSource }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", SOURCE_CLASS[source])}>{SOURCE_LABEL[source]}</span>;
}

function StatusChip({ status }: { status: AbandonedCart["status"] }) {
  const color =
    status === "quente"
      ? "text-emerald-400"
      : status === "pix"
        ? "text-amber-400"
        : status === "abandonado"
          ? "text-[#CC2222]"
          : "text-[#6A6A6A]";
  return <p className={cn("text-[11px] font-bold tracking-widest uppercase", color)}>{STATUS_LABEL[status]}</p>;
}

function biggestLeak(funnel: FunnelWindow) {
  const values = FUNNEL_STEPS.map((step) => funnel[step.key]);
  let index = 1;
  let drop = 0;
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1] ?? 0;
    const current = values[i] ?? 0;
    const nextDrop = prev > 0 ? 1 - current / prev : 0;
    if (nextDrop > drop) {
      drop = nextDrop;
      index = i;
    }
  }
  return { index, drop, from: FUNNEL_STEPS[index - 1]?.label ?? "Visita", to: FUNNEL_STEPS[index]?.label ?? "Produto" };
}

function funnelInsight(funnel: FunnelWindow, leak: ReturnType<typeof biggestLeak>) {
  if (funnel.visit === 0) return "Aguardando tráfego para montar o funil.";
  const end = funnel.visit > 0 ? funnel.purchase / funnel.visit : 0;
  if (leak.drop <= 0) return `Funil sem queda · ${pct(end)} ponta a ponta.`;
  return `Maior perda: ${leak.from} → ${leak.to} (−${pct(leak.drop)}). Conversão ponta a ponta ${pct(end)}.`;
}

function pct(value: number) {
  return `${Math.round(value * 1000) / 10}%`.replace(".", ",");
}
