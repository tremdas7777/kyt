import { ChevronDown, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { MercadoFullBadge } from "@/components/checkout/MercadoFullBadge";
import { assetUrl, catalogPriceFor } from "@/data/catalog";
import type { Offer } from "@/data/offers";
import type { CartItem } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { shippingLabel, type ShippingMethod } from "@/lib/shipping";

export type SummaryProps = {
  items: CartItem[];
  bumps: Offer[];
  shipping: ShippingMethod;
  freight: number;
  listTotal: number;
  pixDiscount: number;
  total: number;
  locked?: boolean;
  onQty?: (id: string, quantity: number) => void;
  onRemove?: (id: string) => void;
};

function Body({ items, bumps, shipping, freight, listTotal, pixDiscount, total, locked, onQty, onRemove }: SummaryProps) {
  return (
    <>
      <ul className="divide-y divide-white/10">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 py-3">
            <img src={assetUrl(item.image)} alt="" className="h-16 w-14 shrink-0 bg-[#111] object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold uppercase">{item.name}</p>
              <p className="text-xs text-[#6A6A6A]">
                {item.color} · Tam. {item.size}
              </p>
              {onQty && onRemove ? (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center border border-white/15">
                    <button
                      type="button"
                      className="p-1.5 disabled:opacity-40"
                      disabled={locked}
                      onClick={() => onQty(item.id, item.quantity - 1)}
                      aria-label={`Diminuir ${item.name}`}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-7 text-center text-xs">{item.quantity}</span>
                    <button
                      type="button"
                      className="p-1.5 disabled:opacity-40"
                      disabled={locked}
                      onClick={() => onQty(item.id, item.quantity + 1)}
                      aria-label={`Aumentar ${item.name}`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-[#6A6A6A] hover:text-[#CC2222] disabled:opacity-40"
                    disabled={locked}
                    onClick={() => onRemove(item.id)}
                    aria-label={`Excluir ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
            <p className="text-sm">{formatBRL(catalogPriceFor(item.productId, item.price) * item.quantity)}</p>
          </li>
        ))}
        {bumps.map((offer) => (
          <li key={offer.id} className="flex gap-3 py-3">
            <span className="flex h-16 w-14 shrink-0 items-center justify-center bg-[#111] font-display text-[10px] font-black uppercase text-emerald-400">
              Oferta
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold uppercase">{offer.name}</p>
              <p className="text-xs text-[#6A6A6A]">1 unidade · oferta do checkout</p>
            </div>
            <p className="text-sm">{formatBRL(offer.price)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-2 border-t border-white/10 pt-3 text-sm text-[#6A6A6A]">
        <div className="flex justify-between">
          <span>Produtos</span>
          <span>{formatBRL(listTotal)}</span>
        </div>
        {pixDiscount > 0 ? (
          <div className="flex justify-between text-emerald-400">
            <span>Desconto PIX 10%</span>
            <span>−{formatBRL(pixDiscount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between">
          <span className="flex items-center gap-2">
            Frete {shipping === "full" ? <MercadoFullBadge className="h-4" /> : null}
          </span>
          <span className={freight > 0 ? "" : "text-emerald-400"}>{freight > 0 ? formatBRL(freight) : "Grátis"}</span>
        </div>
        <p className="text-xs">{shippingLabel(shipping)}</p>
        <div className="flex justify-between border-t border-white/10 pt-3 font-display text-2xl font-black text-[#F0F0F0]">
          <span>Total</span>
          <span>{formatBRL(total)}</span>
        </div>
      </div>
    </>
  );
}

export function SummaryDesktop(props: SummaryProps) {
  return (
    <aside className="hidden h-fit border border-white/10 bg-[#0e0e0e] p-5 lg:block">
      <h2 className="font-display text-lg font-black uppercase">Resumo do pedido</h2>
      <p className="mt-1 mb-2 text-xs text-[#6A6A6A]">Altere quantidades ou exclua itens antes de pagar.</p>
      <Body {...props} />
    </aside>
  );
}

export function SummaryMobile(props: SummaryProps) {
  const [open, setOpen] = useState(false);
  const count = props.items.reduce((sum, item) => sum + item.quantity, 0) + props.bumps.length;
  return (
    <div className="border-y border-white/10 bg-[#0e0e0e] lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-3"
      >
        <span className="text-sm">Resumo do pedido ({count})</span>
        <span className="flex items-center gap-2 font-display text-lg font-black">
          {formatBRL(props.total)}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open ? <div className="border-t border-white/10 px-5 py-4">{<Body {...props} />}</div> : null}
    </div>
  );
}
