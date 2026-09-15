import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";

import { assetUrl } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/carrinho")({
  head: () => ({ meta: [{ title: "Carrinho | KYT Capacetes Brasil" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, updateQty, removeItem, subtotal } = useCart();

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto max-w-5xl px-6 lg:px-10">
        <h1 className="font-display text-5xl font-black uppercase">Carrinho</h1>
        {items.length === 0 ? (
          <div className="mt-12 text-center">
            <p className="text-[#6A6A6A]">Seu carrinho está vazio.</p>
            <Link to="/produtos" className="kyt-btn kyt-btn-primary mt-6">
              Ver produtos
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
            <ul className="divide-y divide-white/10 border-t border-white/10">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 py-6">
                  <img src={assetUrl(item.image)} alt={item.name} className="h-28 w-24 bg-[#111] object-contain" />
                  <div className="flex-1">
                    <p className="font-display text-xl font-bold uppercase">{item.name}</p>
                    <p className="mt-1 text-sm text-[#6A6A6A]">
                      {item.color} · Tam. {item.size}
                    </p>
                    <p className="mt-2 font-display text-[#CC2222]">{formatBRL(item.price)}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center border border-white/15">
                        <button type="button" className="p-2" onClick={() => updateQty(item.id, item.quantity - 1)}>
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                        <button type="button" className="p-2" onClick={() => updateQty(item.id, item.quantity + 1)}>
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[#6A6A6A] hover:text-[#CC2222]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="font-display font-bold">{formatBRL(item.price * item.quantity)}</p>
                </li>
              ))}
            </ul>
            <aside className="h-fit border border-white/10 bg-[#0e0e0e] p-6">
              <h2 className="font-display text-lg font-bold uppercase">Resumo</h2>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-[#6A6A6A]">Subtotal</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-[#6A6A6A]">Frete</span>
                <span>Grátis</span>
              </div>
              <div className="mt-4 flex justify-between border-t border-white/10 pt-4 font-display text-xl font-black">
                <span>Total</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <Link to="/checkout" className="kyt-btn kyt-btn-primary mt-6 w-full">
                Finalizar compra
              </Link>
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
