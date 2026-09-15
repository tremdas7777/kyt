import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2, X } from "lucide-react";

import { useCart } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { assetUrl } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const { items, isOpen, closeCart, updateQty, removeItem, subtotal } = useCart();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-black/70 transition-opacity",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={closeCart}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 z-[70] flex h-full w-full max-w-md flex-col bg-[#0c0c0c] shadow-2xl transition-transform duration-300",
          isOpen ? "translate-x-0" : "pointer-events-none translate-x-full",
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <h2 className="font-display text-xl font-black tracking-[0.12em] uppercase">Carrinho</h2>
          <button type="button" onClick={closeCart} aria-label="Fechar carrinho">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <p className="pt-10 text-center text-sm text-[#6A6A6A]">Seu carrinho está vazio.</p>
          ) : (
            <ul className="flex flex-col gap-5">
              {items.map((item) => (
                <li key={item.id} className="flex gap-4 border-b border-white/8 pb-5">
                  <img
                    src={assetUrl(item.image)}
                    alt={item.name}
                    className="h-24 w-20 object-contain bg-[#111]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-bold uppercase">{item.name}</p>
                    <p className="mt-1 text-xs text-[#6A6A6A]">
                      {item.color} · Tam. {item.size}
                    </p>
                    <p className="mt-2 font-display text-sm font-bold text-[#CC2222]">
                      {formatBRL(item.price)}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center border border-white/15">
                        <button
                          type="button"
                          className="p-2"
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          className="p-2"
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-[#6A6A6A] hover:text-[#CC2222]"
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 px-6 py-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-[#6A6A6A]">Subtotal</span>
            <span className="font-display text-xl font-black">{formatBRL(subtotal)}</span>
          </div>
          {items.length === 0 ? (
            <span className="kyt-btn kyt-btn-primary w-full opacity-40">Finalizar compra</span>
          ) : (
            <Link to="/checkout" onClick={closeCart} className="kyt-btn kyt-btn-primary w-full">
              Finalizar compra
            </Link>
          )}
          <Link
            to="/carrinho"
            onClick={closeCart}
            className="mt-3 block text-center font-display text-xs font-bold tracking-[0.16em] uppercase text-[#6A6A6A] hover:text-white"
          >
            Ver carrinho
          </Link>
        </div>
      </aside>
    </>
  );
}
