import { Check, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { assetUrl } from "@/data/catalog";
import type { Offer } from "@/data/offers";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Aparece (sobe) quando o cliente rola até o elemento. */
function useReveal(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(!enabled);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return { ref, shown };
}

/** Oferta adicional (order bump) logo acima do botão de finalizar, no estilo da Aidex. */
export function OrderBump({
  offer,
  checked,
  onChange,
  reveal = false,
}: {
  offer: Offer;
  checked: boolean;
  onChange: (value: boolean) => void;
  reveal?: boolean;
}) {
  const { ref, shown } = useReveal(reveal);
  const off = offer.compareAt ? Math.round((1 - offer.price / offer.compareAt) * 100) : 0;
  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden border-2 border-dashed transition-[border-color,background-color,opacity,translate] duration-700 ease-out motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        checked ? "border-emerald-500 bg-emerald-500/[0.05]" : "border-amber-400 bg-amber-400/[0.06]",
      )}
    >
      <div className="bg-amber-400 px-4 py-1.5 text-center font-display text-[11px] font-black tracking-[0.14em] text-[#1a1200] uppercase">
        Oferta exclusiva — só aparece nesta tela
      </div>
      <div className="p-4">
        <p className="font-display text-base font-bold leading-snug">{offer.question}</p>
        <p className="mt-2 text-sm leading-relaxed text-[#A0A0A0]">{offer.body}</p>
        <div className="mt-4 flex gap-4">
          {offer.image ? (
            <img
              src={assetUrl(offer.image)}
              alt={offer.fullName}
              width={88}
              height={88}
              loading="lazy"
              className="h-[88px] w-[88px] shrink-0 border border-white/10 bg-[#111] object-contain"
            />
          ) : (
            <span className="flex h-[88px] w-[88px] shrink-0 items-center justify-center border border-white/10 bg-[#111]">
              <ShieldCheck className="h-10 w-10 text-emerald-400" strokeWidth={1.5} />
            </span>
          )}
          <ul className="space-y-1.5 text-[13px] leading-snug">
            {offer.benefits.map((benefit) => (
              <li key={benefit} className="flex gap-1.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {offer.compareAt ? <span className="text-sm text-[#6A6A6A] line-through">{formatBRL(offer.compareAt)}</span> : null}
          <span className="font-display text-2xl font-black text-emerald-400">{formatBRL(offer.price)}</span>
          {off > 0 ? (
            <span className="bg-emerald-500/15 px-1.5 py-0.5 font-display text-[11px] font-black text-emerald-400">{off}% OFF</span>
          ) : null}
          <span className="w-full text-xs text-[#6A6A6A]">Entra na mesma cobrança do pedido, sem frete extra.</span>
        </div>
        <label
          className={cn(
            "mt-4 flex cursor-pointer items-center gap-3 border-2 px-3 py-3 transition-colors",
            checked ? "border-emerald-500 bg-emerald-500/10" : "border-amber-400 bg-[#111] animate-pulse [animation-duration:2.5s]",
          )}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-emerald-500"
          />
          <span className="font-display text-sm font-bold uppercase leading-snug">
            {checked ? `Adicionado! ${offer.name} incluído no seu pedido.` : offer.cta.replace("{preco}", formatBRL(offer.price))}
          </span>
        </label>
      </div>
    </div>
  );
}
