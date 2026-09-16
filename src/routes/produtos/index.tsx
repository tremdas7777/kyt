import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { assetUrl, categories, minPrice, productCover, products } from "@/data/catalog";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Produtos | KYT Capacetes Brasil" },
      { name: "description", content: "Compre capacetes KYT oficiais. A partir de R$ 297." },
    ],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  const [category, setCategory] = useState<(typeof categories)[number]>("Racing");
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
          {filtered.map((product) => {
            const cover = productCover(product);
            const color = product.colors[product.defaultColorIdx ?? 0];
            return (
              <Link
                key={product.id}
                to="/produtos/$slug"
                params={{ slug: product.id }}
                className="group block"
              >
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
