import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { VisorCard } from "@/components/visors/VisorCard";
import { assetUrl, getProduct } from "@/data/catalog";
import { getVisor, VISOR_CART_PREFIX, VISOR_PRICE, visorColor, visors } from "@/data/visors";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { newEventId, trackEvent } from "@/lib/pixel-client";
import { cn } from "@/lib/utils";

type VisorSearch = { cor?: string };

export const Route = createFileRoute("/viseiras/$id")({
  validateSearch: (search: Record<string, unknown>): VisorSearch => {
    const cor = typeof search["cor"] === "string" ? search["cor"].trim() : "";
    return cor ? { cor } : {};
  },
  loader: ({ params }) => {
    const visor = getVisor(params.id);
    if (!visor) throw notFound();
    return { visor };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.visor.name ?? "Viseira"} | KYT Capacetes Brasil` },
      { name: "description", content: loaderData?.visor.description.slice(0, 160) ?? "" },
    ],
  }),
  component: VisorPage,
});

const BENEFITS = ["Original KYT, encaixe perfeito", "Policarbonato de alta resistência", "Tratamento anti-risco", "Preparada para Pinlock®"];

function VisorPage() {
  const { visor } = Route.useLoaderData();
  const { cor } = Route.useSearch();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [slug, setSlug] = useState(visorColor(visor, cor).slug);
  const [qty, setQty] = useState(1);
  const color = visorColor(visor, slug);
  const productId = `${VISOR_CART_PREFIX}${visor.id}`;
  const compatible = visor.compatible.map((id) => getProduct(id));
  const others = visors.filter((entry) => entry.id !== visor.id).slice(0, 4);

  const payload = {
    productId,
    name: `Viseira ${visor.model}`,
    color: color.name,
    size: "Único",
    image: color.image,
    price: VISOR_PRICE,
    quantity: qty,
  };

  function track() {
    trackEvent({
      event: "AddToCart",
      eventId: newEventId("atc"),
      value: VISOR_PRICE * qty,
      contents: [{ id: productId, name: payload.name, quantity: qty, price: VISOR_PRICE }],
    });
  }

  function addToCart() {
    addItem(payload);
    track();
    toast.success(`${payload.name} · ${color.name} adicionada`);
  }

  function buyNow() {
    addItem(payload, { open: false });
    track();
    void navigate({ to: "/checkout" });
  }

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="font-display text-xs font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">
          <Link to="/" className="hover:text-white">
            Início
          </Link>{" "}
          /{" "}
          <Link to="/viseiras" className="hover:text-white">
            Viseiras
          </Link>{" "}
          / <span className="text-[#CC2222]">{visor.model}</span>
        </p>

        <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-2 lg:gap-12 [&>*]:min-w-0">
          <div>
            <div className="border border-white/10 bg-[#f3f3f3]">
              <img src={assetUrl(color.image)} alt={`${visor.name} ${color.name}`} className="aspect-square w-full object-contain p-6 sm:p-10" />
            </div>
            {visor.colors.length > 1 ? (
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                {visor.colors.map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => setSlug(entry.slug)}
                    aria-label={entry.name}
                    className={cn(
                      "h-16 w-16 shrink-0 overflow-hidden border bg-[#f3f3f3]",
                      entry.slug === color.slug ? "border-[#CC2222]" : "border-white/10 opacity-70 hover:opacity-100",
                    )}
                  >
                    <img src={assetUrl(entry.image)} alt="" className="h-full w-full object-contain p-1" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">Viseira original KYT</p>
            <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none md:text-5xl">{visor.model}</h1>
            <p className="mt-3 text-sm text-[#F0F0F0]/80">Cor: {color.name}</p>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-3">
              {color.officialPrice > VISOR_PRICE ? <span className="text-base text-[#6A6A6A] line-through">{formatBRL(color.officialPrice)}</span> : null}
              <span className="font-display text-4xl font-black">{formatBRL(VISOR_PRICE)}</span>
            </div>
            <p className="mt-1 text-sm text-[#CC2222]">à vista no PIX</p>

            <div className="mt-6 border border-white/10 p-4 sm:p-5">
              <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">Cor</p>
              <p className="mt-1 font-display text-lg font-black uppercase">{color.name}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {visor.colors.map((entry) => (
                  <button
                    key={entry.slug}
                    type="button"
                    onClick={() => setSlug(entry.slug)}
                    className={cn(
                      "border px-2 py-2.5 font-display text-xs font-bold uppercase",
                      entry.slug === color.slug ? "border-[#CC2222] bg-[#CC2222] text-white" : "border-white/15 text-[#F0F0F0] hover:border-white/40",
                    )}
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 border border-white/10 p-4 sm:p-5">
              <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">Compatível com</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {visor.fits.map((name) => {
                  const product = compatible.find((entry) => entry?.name.toLowerCase().replace(/[^a-z0-9]/g, "") === name.toLowerCase().replace(/[^a-z0-9]/g, ""));
                  return product ? (
                    <Link
                      key={name}
                      to="/produtos/$slug"
                      params={{ slug: product.id }}
                      className="border border-white/15 px-3 py-1.5 font-display text-xs font-bold uppercase hover:border-[#CC2222] hover:text-[#CC2222]"
                    >
                      Capacete {name}
                    </Link>
                  ) : (
                    <span key={name} className="border border-white/10 px-3 py-1.5 font-display text-xs font-bold uppercase text-[#A0A0A0]">
                      Capacete {name}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center border border-white/15">
                <button type="button" className="px-4 py-3" onClick={() => setQty((value) => Math.max(1, value - 1))} aria-label="Diminuir">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center">{qty}</span>
                <button type="button" className="px-4 py-3" onClick={() => setQty((value) => value + 1)} aria-label="Aumentar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={buyNow} className="kyt-btn kyt-btn-primary flex-1">
                Comprar agora
              </button>
              <button type="button" onClick={addToCart} className="kyt-btn kyt-btn-outline flex-1">
                Adicionar ao carrinho
              </button>
            </div>

            <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex items-center gap-2 text-sm text-[#A0A0A0]">
                  <Check className="h-4 w-4 shrink-0 text-emerald-400" /> {benefit}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-base leading-relaxed text-[#6A6A6A]">{visor.description}</p>
          </div>
        </div>

        <section className="mt-20">
          <h2 className="font-display text-3xl font-black uppercase">Outras viseiras</h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((entry) => (
              <VisorCard key={entry.id} visor={entry} />
            ))}
          </div>
          <Link to="/viseiras" className="kyt-btn kyt-btn-outline mt-8">
            Ver todas as viseiras
          </Link>
        </section>
      </div>
    </section>
  );
}
