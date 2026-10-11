import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  assetUrl,
  categories,
  colorCover,
  headSizes,
  minPrice,
  productCover,
  products,
  type Product,
} from "@/data/catalog";
import { formatBRL } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { newEventId, trackEvent } from "@/lib/pixel-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos | KYT Capacetes Brasil" },
      { name: "description", content: "Compre capacetes KYT oficiais. Todos por R$ 99." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("Sport Touring");
  const filtered = useMemo(() => {
    const list = products.filter((item) => item.category === category);
    return list.sort((left, right) => left.price - right.price || left.name.localeCompare(right.name));
  }, [category]);

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="font-display text-xs font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">
          Início / Produtos
        </p>
        <h1 className="mt-4 font-display text-5xl font-black uppercase md:text-6xl">Nossos Capacetes</h1>
        <p className="mt-4 max-w-xl text-[#6A6A6A]">
          A partir de {formatBRL(minPrice)}. Escolha o modelo, o grafismo e o tamanho.
        </p>

        <div className="mt-8 flex flex-wrap gap-1">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={cn(
                "px-4 py-2 font-display text-xs font-bold tracking-widest uppercase",
                category === item ? "bg-[#CC2222] text-white" : "bg-[#1a1a1a] text-[#6a6a6a]",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [size, setSize] = useState<(typeof headSizes)[number]["id"] | null>(null);
  const [attempted, setAttempted] = useState(false);

  const cover = productCover(product);
  const color = product.colors[product.defaultColorIdx ?? 0];
  const image = color ? colorCover(color) : (product.images[0] ?? "");
  const selectedSize = headSizes.find((entry) => entry.id === size);
  const ready = Boolean(size);

  function requireSize() {
    setAttempted(true);
    if (!size) {
      toast.error("Escolha o tamanho");
      return false;
    }
    return true;
  }

  function buyNow() {
    if (!requireSize()) return;
    addItem(
      {
        productId: product.id,
        name: product.name,
        color: color?.name ?? "",
        size: size ?? "",
        image,
        price: product.price,
        quantity: 1,
      },
      { open: false },
    );
    trackEvent({
      event: "AddToCart",
      eventId: newEventId("atc"),
      value: product.price,
      contents: [{ id: product.id, name: product.name, quantity: 1, price: product.price }],
    });
    void navigate({ to: "/checkout" });
  }

  return (
    <div className="group block">
      <Link to="/produtos/$slug" params={{ slug: product.id }} className="block">
        <div className="relative overflow-hidden bg-[#111]">
          {product.badge ? (
            <span className="absolute top-4 left-4 z-10 bg-[#CC2222] px-2 py-1 font-display text-[10px] font-bold tracking-widest text-white uppercase">
              {product.badge}
            </span>
          ) : null}
          <img
            src={assetUrl(cover)}
            alt={product.name}
            className="aspect-square w-full object-contain transition duration-500 group-hover:scale-[1.04]"
          />
        </div>
        <p className="mt-4 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
          {product.category}
        </p>
        <h2 className="mt-1 font-display text-2xl font-black uppercase">{product.name}</h2>
        <p className="mt-1 text-sm text-[#6A6A6A]">
          {color?.name ?? `${product.colors.length} grafismos`}
        </p>
        <p className="mt-2 font-display text-xl font-bold">{formatBRL(product.price)}</p>
      </Link>

      <div
        className={cn(
          "mt-4 border p-3",
          attempted && !size ? "border-[#CC2222]" : "border-white/10",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">Tamanho</p>
          <p className="text-xs text-[#6A6A6A]">{selectedSize ? `${selectedSize.label} · ${selectedSize.cm}` : "Escolha"}</p>
        </div>
        <div className="grid grid-cols-6 gap-1">
          {headSizes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSize(entry.id)}
              className={cn(
                "min-h-[3.25rem] border px-1 py-2 text-center",
                size === entry.id
                  ? "border-[#CC2222] bg-[#CC2222] text-white"
                  : "border-white/15 text-[#F0F0F0] hover:border-white/40",
              )}
            >
              <span className="block font-display text-xs font-bold">{entry.label}</span>
              <span className="mt-0.5 block text-[9px] text-current/70">{entry.cm}</span>
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={buyNow} className="kyt-btn kyt-btn-primary mt-3 w-full">
        {ready ? "Comprar agora" : "Escolha o tamanho"}
      </button>
    </div>
  );
}
