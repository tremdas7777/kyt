import { Link } from "@tanstack/react-router";

import { SectionCarousel } from "@/components/home/SectionCarousel";
import { assetUrl, categories, colorCover, products, type Product } from "@/data/catalog";
import { formatBRL } from "@/lib/format";

type Category = (typeof categories)[number];

const COPY: Record<Category, { kicker: string; description: string }> = {
  "Sport Touring": { kicker: "Linha Sport Touring", description: "Réplicas dos pilotos e grafismos exclusivos para o dia a dia com DNA de pista." },
  Racing: { kicker: "Linha Racing", description: "Composite, aerodinâmica de túnel de vento e homologação para quem leva a sério." },
  City: { kicker: "Linha City", description: "Leveza e estilo para a cidade, com a mesma segurança KYT." },
};

/** Carrossel de modelos de uma categoria (cada card leva à página do produto). */
export function ProductCarousel({ category }: { category: Category }) {
  const list = products
    .filter((item) => item.category === category)
    .sort((left, right) => left.price - right.price || left.name.localeCompare(right.name));
  if (list.length === 0) return null;
  const copy = COPY[category];

  // Com poucos modelos, mostramos também os grafismos mais populares de cada um.
  const slides = list.flatMap((product) => {
    const picks = list.length >= 3 ? [product.defaultColorIdx ?? 0] : product.colors.slice(0, 3).map((_, idx) => idx);
    return picks.map((colorIdx) => ({ key: `${product.id}-${colorIdx}`, node: <ProductCard product={product} colorIdx={colorIdx} /> }));
  });

  return (
    <SectionCarousel
      kicker={copy.kicker}
      title={category}
      description={copy.description}
      link={{ label: "Ver todos", href: "/produtos" }}
      slides={slides}
      slideClass="flex-[0_0_78%] sm:flex-[0_0_46%] lg:flex-[0_0_31.5%]"
    />
  );
}

function ProductCard({ product, colorIdx }: { product: Product; colorIdx: number }) {
  const color = product.colors[colorIdx] ?? product.colors[0];
  const image = color ? colorCover(color) : (product.images[0] ?? "");
  return (
    <Link
      to="/produtos/$slug"
      params={{ slug: product.id }}
      search={color ? { grafia: slugify(color.name) } : {}}
      className="group block border border-white/10 bg-[#0e0e0e] p-4 transition-colors hover:border-[#CC2222]/60"
    >
      <div className="relative overflow-hidden bg-[#111]">
        {product.badge ? (
          <span className="absolute top-3 left-3 z-10 bg-[#CC2222] px-2 py-1 font-display text-[10px] font-bold tracking-widest text-white uppercase">{product.badge}</span>
        ) : null}
        <img src={assetUrl(image)} alt={`${product.name} ${color?.name ?? ""}`} loading="lazy" className="aspect-square w-full object-contain transition duration-500 group-hover:scale-[1.05]" />
      </div>
      <p className="mt-4 font-display text-[11px] font-bold tracking-[0.16em] text-[#CC2222] uppercase">{product.category}</p>
      <h3 className="mt-1 font-display text-2xl font-black uppercase leading-none">{product.name}</h3>
      <p className="mt-1 truncate text-sm text-[#6A6A6A]">{color?.name ?? `${product.colors.length} grafismos`}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-xl font-black">{formatBRL(product.price)}</span>
        <span className="text-xs text-[#6A6A6A]">à vista no PIX</span>
      </div>
      <span className="kyt-btn kyt-btn-outline mt-4 w-full">Ver modelo</span>
    </Link>
  );
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
