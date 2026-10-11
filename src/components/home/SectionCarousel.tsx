import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Seção da home com carrossel (embla): cabeçalho (kicker + título + link) e setas.
 * `slideClass` define a largura de cada slide por breakpoint.
 */
export function SectionCarousel({
  id,
  kicker,
  title,
  description,
  link,
  slides,
  slideClass = "flex-[0_0_82%] sm:flex-[0_0_48%] lg:flex-[0_0_32%]",
  autoplayMs,
  light,
  className,
}: {
  id?: string;
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  link?: { label: string; href: string };
  slides: { key: string; node: ReactNode }[];
  slideClass?: string;
  autoplayMs?: number;
  /** Fundo claro (seção dos pilotos). */
  light?: boolean;
  className?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: slides.length > 2, align: "start", dragFree: false, duration: 24 });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => {
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    };
    sync();
    emblaApi.on("select", sync);
    emblaApi.on("reInit", sync);
    return () => {
      emblaApi.off("select", sync);
      emblaApi.off("reInit", sync);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !autoplayMs || paused || slides.length <= 1) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), autoplayMs);
    return () => window.clearInterval(timer);
  }, [emblaApi, autoplayMs, paused, slides.length]);

  const go = useCallback((direction: -1 | 1) => (direction < 0 ? emblaApi?.scrollPrev() : emblaApi?.scrollNext()), [emblaApi]);

  const arrow = cn(
    "flex h-11 w-11 items-center justify-center border transition-colors disabled:opacity-30",
    light ? "border-[#ddd] text-[#888] hover:border-[#CC2222] hover:text-[#CC2222]" : "border-white/20 text-white hover:border-[#CC2222] hover:bg-[#CC2222]",
  );

  return (
    <section
      id={id}
      className={cn("w-full overflow-hidden py-16 lg:py-24", light ? "bg-[#f3f3f3] text-[#080808]" : "bg-[#080808] text-[#F0F0F0]", className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            {kicker ? <p className="mb-2 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">{kicker}</p> : null}
            <h2 className="font-display text-4xl font-black uppercase leading-none md:text-5xl">{title}</h2>
            {description ? <p className={cn("mt-3 max-w-xl text-sm leading-relaxed md:text-base", light ? "text-[#555]" : "text-[#6A6A6A]")}>{description}</p> : null}
          </div>
          <div className="flex items-center gap-3">
            {link ? (
              <Link
                to={link.href}
                className={cn("font-display text-xs font-bold tracking-[0.16em] uppercase underline-offset-4 hover:underline", light ? "text-[#080808]" : "text-[#F0F0F0]")}
              >
                {link.label}
              </Link>
            ) : null}
            <button type="button" aria-label="Anterior" onClick={() => go(-1)} disabled={!canPrev && slides.length <= 2} className={arrow}>
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Próximo" onClick={() => go(1)} disabled={!canNext && slides.length <= 2} className={arrow}>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex touch-pan-y gap-4">
            {slides.map((slide) => (
              <div key={slide.key} className={cn("min-w-0", slideClass)}>
                {slide.node}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
