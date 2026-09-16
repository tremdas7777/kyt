import { Link, useNavigate } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { GraphicPicker } from "@/components/product/GraphicPicker";
import { PriceLines } from "@/components/product/PriceLines";
import { SizeChartButton } from "@/components/product/SizeChart";
import { assetUrl, colorCover, graphicSlug, headSizes, products, type Product } from "@/data/catalog";
import { useCart } from "@/lib/cart";
import { newEventId, trackEvent } from "@/lib/pixel-client";
import { cn } from "@/lib/utils";

const HOME_LINES = ["City", "Sport Touring", "Racing"] as const;

function modelsFor(category: (typeof HOME_LINES)[number]) {
  const byPrice = (left: Product, right: Product) => left.price - right.price || left.name.localeCompare(right.name);
  return products.filter((item) => item.category === category).sort(byPrice);
}

export function ProductsShowcase() {
  return (
    <section id="produtos" className="w-full overflow-hidden bg-[#080808] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-16">
          <p className="mb-2 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
            Nossa Linha
          </p>
          <h2 className="font-display text-4xl font-black uppercase leading-none text-[#F0F0F0] md:text-5xl">
            Nossos Capacetes
          </h2>
        </div>

        <div className="space-y-24 lg:space-y-32">
          {HOME_LINES.map((line) => (
            <CategoryCarousel key={line} category={line} models={modelsFor(line)} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryCarousel({
  category,
  models,
}: {
  category: (typeof HOME_LINES)[number];
  models: Product[];
}) {
  const [modelIdx, setModelIdx] = useState(0);
  const product = models[modelIdx] ?? models[0];

  const goModel = useCallback(
    (direction: -1 | 1) => {
      if (models.length === 0) return;
      setModelIdx((current) => (current + direction + models.length) % models.length);
    },
    [models.length],
  );

  if (!product) return null;

  return (
    <div id={category.toLowerCase().replace(/\s+/g, "-")}>
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase">{category}</p>
          <p className="mt-1 font-display text-2xl font-black uppercase md:text-3xl">
            {String(modelIdx + 1).padStart(2, "0")} / {String(models.length).padStart(2, "0")}
            <span className="ml-3 text-white">{product.name}</span>
          </p>
        </div>
        {models.length > 1 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goModel(-1)}
              aria-label={`Modelo anterior de ${category}`}
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-white hover:border-[#CC2222] hover:bg-[#CC2222]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => goModel(1)}
              aria-label={`Próximo modelo de ${category}`}
              className="flex h-11 w-11 items-center justify-center border border-white/20 text-white hover:border-[#CC2222] hover:bg-[#CC2222]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto">
        {models.map((item, idx) => (
          <button
            key={`${category}-${item.id}`}
            type="button"
            onClick={() => setModelIdx(idx)}
            className={cn(
              "shrink-0 border px-4 py-2 font-display text-xs font-bold tracking-widest uppercase",
              idx === modelIdx ? "border-[#CC2222] bg-[#CC2222] text-white" : "border-white/10 text-[#6A6A6A] hover:text-white",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <CollectionSlide key={`${category}-${product.id}`} product={product} />
    </div>
  );
}

function CollectionSlide({ product }: { product: Product }) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [size, setSize] = useState<(typeof headSizes)[number]["id"] | null>(null);
  const [attempted, setAttempted] = useState(false);
  const selectedSize = headSizes.find((entry) => entry.id === size);
  const colors = product.colors;
  const startIdx = useMemo(() => {
    const preferred = product.defaultColorIdx ?? 0;
    if (preferred >= 0 && preferred < colors.length) return preferred;
    return 0;
  }, [product.defaultColorIdx, colors.length]);
  const [colorIdx, setColorIdx] = useState(startIdx);
  const [autoplay, setAutoplay] = useState(true);
  const [inView, setInView] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: colors.length > 1,
    align: "center",
    duration: 22,
  });
  const color = colors[colorIdx] ?? colors[0];

  useEffect(() => {
    const viewport = emblaApi?.rootNode();
    if (!viewport || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { threshold: 0.35 },
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(startIdx, true);
    setColorIdx(emblaApi.selectedScrollSnap());
    const sync = () => setColorIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", sync);
    emblaApi.on("reInit", sync);
    return () => {
      emblaApi.off("select", sync);
      emblaApi.off("reInit", sync);
    };
  }, [emblaApi, startIdx]);

  useEffect(() => {
    if (!autoplay || !inView || !emblaApi || colors.length <= 1) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), 4200);
    return () => window.clearInterval(timer);
  }, [autoplay, inView, emblaApi, colors.length]);

  const goHelmet = useCallback(
    (direction: -1 | 1) => {
      setAutoplay(false);
      if (direction < 0) emblaApi?.scrollPrev();
      else emblaApi?.scrollNext();
    },
    [emblaApi],
  );

  function selectColor(index: number) {
    setAutoplay(false);
    setColorIdx(index);
    emblaApi?.scrollTo(index);
  }

  const grafia = color ? graphicSlug(color.name) : undefined;

  function requireSize() {
    setAttempted(true);
    if (!size) {
      toast.error("Escolha o tamanho");
      return false;
    }
    return true;
  }

  function cartPayload() {
    return {
      productId: product.id,
      name: product.name,
      color: color?.name ?? "",
      size: size ?? "",
      image: color ? colorCover(color) : (product.images[0] ?? ""),
      price: product.price,
      quantity: 1,
    };
  }

  function trackAdd() {
    trackEvent({
      event: "AddToCart",
      eventId: newEventId("atc"),
      value: product.price,
      contents: [{ id: product.id, name: product.name, quantity: 1, price: product.price }],
    });
  }

  function addToCart() {
    if (!requireSize()) return;
    addItem(cartPayload());
    trackAdd();
    toast.success(`${product.name} · ${color?.name ?? ""} · ${size} adicionado`);
  }

  return (
    <div className="grid items-start gap-10 lg:grid-cols-2">
      <div>
        <div className="relative bg-[#111]">
          <div ref={emblaRef} className="overflow-hidden">
            <div className="flex touch-pan-y">
              {colors.map((entry) => (
                <div key={entry.name} className="min-w-0 shrink-0 basis-full">
                  <div className="aspect-square">
                    <img
                      src={assetUrl(colorCover(entry))}
                      alt={entry.name}
                      draggable={false}
                      className={cn("h-full w-full object-contain", product.flipX && "scale-x-[-1]")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {colors.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => goHelmet(-1)}
                aria-label="Capacete anterior"
                className="absolute top-1/2 left-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/50 text-white hover:border-white"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => goHelmet(1)}
                aria-label="Próximo capacete"
                className="absolute top-1/2 right-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/50 text-white hover:border-white"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div>
        <p className="font-display text-xs font-bold tracking-[0.16em] text-[#6A6A6A] uppercase">{product.category}</p>
        <h3 className="mt-2 font-display text-5xl font-black uppercase leading-none md:text-6xl">{product.name}</h3>

        <div className="mt-6">
          <PriceLines price={product.price} size="lg" />
        </div>

        <div className="mt-6 border border-white/10 p-4">
          <GraphicPicker product={product} colorIdx={colorIdx} onSelect={selectColor} />
        </div>

        <div className={cn("mt-6 border p-4", attempted && !size ? "border-[#CC2222]" : "border-white/10")}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">Tamanho</p>
              <p className="mt-1 font-display text-lg font-black uppercase">
                {selectedSize ? `${selectedSize.label} · ${selectedSize.cm}` : "Escolha o tamanho"}
              </p>
            </div>
            <SizeChartButton />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {headSizes.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSize(entry.id)}
                className={cn(
                  "min-h-[4.25rem] border px-2 py-3 text-center",
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
        </div>

        <button type="button" onClick={addToCart} className="kyt-btn kyt-btn-primary">
          Adicionar ao carrinho
        </button>
        <p className="mt-5 max-w-lg font-sans text-base leading-relaxed text-[#6A6A6A]">{product.description}</p>
        <Link
          to="/produtos/$slug"
          params={{ slug: product.id }}
          search={grafia ? { grafia } : {}}
          className="mt-4 inline-block font-display text-xs font-bold tracking-[0.16em] text-[#6A6A6A] uppercase hover:text-white"
        >
          Ver modelo completo
        </Link>
      </div>
    </div>
  );
}
