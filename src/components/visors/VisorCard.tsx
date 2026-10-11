import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { assetUrl } from "@/data/catalog";
import { VISOR_PRICE, visorColor, type Visor } from "@/data/visors";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Card de viseira com amostras de cor (troca a foto ao passar/clicar). */
export function VisorCard({ visor, className }: { visor: Visor; className?: string }) {
  const [slug, setSlug] = useState(visor.colors[0]?.slug);
  const color = visorColor(visor, slug);
  return (
    <div className={cn("group flex h-full flex-col border border-white/10 bg-[#0e0e0e] p-4 transition-colors hover:border-[#CC2222]/60", className)}>
      <Link to="/viseiras/$id" params={{ id: visor.id }} search={{ cor: color.slug }} className="block">
        <div className="overflow-hidden bg-[#f3f3f3]">
          <img
            src={assetUrl(color.image)}
            alt={`${visor.name} ${color.name}`}
            loading="lazy"
            className="aspect-[4/3] w-full object-contain p-4 transition duration-500 group-hover:scale-[1.04]"
          />
        </div>
        <p className="mt-4 font-display text-[11px] font-bold tracking-[0.16em] text-[#CC2222] uppercase">Viseira original</p>
        <h3 className="mt-1 font-display text-xl font-black uppercase leading-tight">{visor.model}</h3>
        <p className="mt-1 text-sm text-[#6A6A6A]">
          {color.name} · {visor.colors.length} {visor.colors.length === 1 ? "cor" : "cores"}
        </p>
      </Link>
      {visor.colors.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visor.colors.map((entry) => (
            <button
              key={entry.slug}
              type="button"
              onMouseEnter={() => setSlug(entry.slug)}
              onFocus={() => setSlug(entry.slug)}
              onClick={() => setSlug(entry.slug)}
              aria-label={entry.name}
              title={entry.name}
              className={cn(
                "h-8 w-8 overflow-hidden border bg-[#f3f3f3]",
                entry.slug === color.slug ? "border-[#CC2222]" : "border-white/10 opacity-70 hover:opacity-100",
              )}
            >
              <img src={assetUrl(entry.image)} alt="" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-baseline gap-x-2">
          {color.officialPrice > VISOR_PRICE ? <span className="text-sm text-[#6A6A6A] line-through">{formatBRL(color.officialPrice)}</span> : null}
          <span className="font-display text-2xl font-black">{formatBRL(VISOR_PRICE)}</span>
        </div>
        <p className="text-xs text-[#6A6A6A]">à vista no PIX</p>
        <Link to="/viseiras/$id" params={{ id: visor.id }} search={{ cor: color.slug }} className="kyt-btn kyt-btn-outline mt-3 w-full">
          Ver viseira
        </Link>
      </div>
    </div>
  );
}
