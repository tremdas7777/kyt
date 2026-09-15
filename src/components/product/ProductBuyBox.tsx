import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { GraphicCarousel } from "@/components/product/GraphicCarousel";
import { PriceLines } from "@/components/product/PriceLines";
import { colorCover, headSizes, type Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

type SizeId = (typeof headSizes)[number]["id"];

export function ProductBuyBox({ product }: { product: Product }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [colorIdx, setColorIdx] = useState(0);
  const [size, setSize] = useState<SizeId | null>(null);
  const [qty, setQty] = useState(1);
  const [attempted, setAttempted] = useState(false);

  const color = product.colors[colorIdx] ?? product.colors[0];
  const selectedImage = color ? colorCover(color) : (product.images[0] ?? "");
  const selectedSize = headSizes.find((entry) => entry.id === size);
  const ready = Boolean(color && size);

  const onColorChange = useCallback((index: number) => {
    setColorIdx(index);
  }, []);

  const payload = useMemo(
    () => ({
      productId: product.id,
      name: product.name,
      color: color?.name ?? "",
      size: size ?? "",
      image: selectedImage,
      price: product.price,
      quantity: qty,
    }),
    [product, color, size, selectedImage, qty],
  );

  function requireSize() {
    setAttempted(true);
    if (!size) {
      toast.error("Escolha o tamanho");
      document.getElementById("escolher-tamanho")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function addToCart() {
    if (!requireSize()) return;
    addItem(payload);
    toast.success(`${product.name} · ${payload.color} · ${payload.size} adicionado`);
  }

  function buyNow() {
    if (!requireSize()) return;
    addItem(payload, { open: false });
    void navigate({ to: "/checkout" });
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="lg:sticky lg:top-24">
        <GraphicCarousel product={product} colorIdx={colorIdx} onColorChange={onColorChange} />
      </div>

      <div>
        <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">
          {product.category}
        </p>
        <h1 className="mt-3 font-display text-5xl font-black uppercase leading-none md:text-6xl">{product.name}</h1>
        <p className="mt-3 font-sans text-sm text-[#F0F0F0]/80">
          {color?.name ?? "Escolha um grafismo no carrossel"}
        </p>
        <div className="mt-6">
          <PriceLines price={product.price} size="lg" />
        </div>
        <p className="mt-2 text-sm text-[#6A6A6A]">Frete grátis para todo o Brasil</p>

        <div
          id="escolher-tamanho"
          className={cn("mt-8 border p-4 sm:p-5", attempted && !size ? "border-[#CC2222]" : "border-white/10")}
        >
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">Tamanho</p>
              <p className="mt-1 font-display text-lg font-black uppercase">
                {selectedSize ? `${selectedSize.label} · ${selectedSize.cm}` : "Escolha o tamanho"}
              </p>
            </div>
            <span className="shrink-0 font-display text-[10px] font-bold tracking-widest text-[#6A6A6A] uppercase">
              Obrigatório
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {headSizes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSize(entry.id)}
                className={cn(
                  "border px-2 py-3 text-center",
                  size === entry.id
                    ? "border-[#CC2222] bg-[#CC2222] text-white"
                    : "border-white/15 text-[#F0F0F0] hover:border-white/40",
                )}
              >
                <span className="block font-display text-sm font-bold">{entry.label}</span>
                <span className="mt-1 block text-[10px] text-current/70">{entry.cm}</span>
              </button>
            ))}
          </div>
          {selectedSize ? (
            <p className="mt-3 text-xs text-[#6A6A6A]">Casco {selectedSize.shell}</p>
          ) : attempted ? (
            <p className="mt-3 text-sm text-[#CC2222]">Selecione o tamanho da sua cabeça.</p>
          ) : (
            <p className="mt-3 text-xs text-[#6A6A6A]">Meça a circunferência da cabeça para acertar o tamanho.</p>
          )}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <div className="flex items-center border border-white/15">
            <button type="button" className="px-4 py-3" onClick={() => setQty((value) => Math.max(1, value - 1))}>
              −
            </button>
            <span className="min-w-8 text-center">{qty}</span>
            <button type="button" className="px-4 py-3" onClick={() => setQty((value) => value + 1)}>
              +
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={buyNow}
            className={cn("kyt-btn kyt-btn-primary flex-1", !ready && "opacity-60")}
          >
            {ready ? "Comprar agora" : "Escolha o tamanho"}
          </button>
          <button type="button" onClick={addToCart} className="kyt-btn kyt-btn-outline flex-1">
            Adicionar ao carrinho
          </button>
        </div>

        <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-[#6A6A6A]">{product.description}</p>
        <Link
          to="/produtos"
          className="mt-4 inline-block font-display text-xs font-bold tracking-[0.16em] text-[#6A6A6A] uppercase hover:text-white"
        >
          Ver todos os produtos
        </Link>
      </div>
    </div>
  );
}
