import { ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

import { assetUrl, colorCover, type Product, type ProductColor } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function GraphicCarousel({
  product,
  colorIdx,
  onColorChange,
}: {
  product: Product;
  colorIdx: number;
  onColorChange: (index: number) => void;
}) {
  const colors = product.colors;
  const color = colors[colorIdx] ?? colors[0];
  const gallery = color?.images ?? product.images;
  const [imageIdx, setImageIdx] = useState(color?.coverIndex ?? 0);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: colors.length > 1,
    align: "center",
    duration: 22,
  });

  useEffect(() => {
    setImageIdx(color?.coverIndex ?? 0);
  }, [color]);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => onColorChange(emblaApi.selectedScrollSnap());
    emblaApi.on("select", sync);
    emblaApi.on("reInit", sync);
    return () => {
      emblaApi.off("select", sync);
      emblaApi.off("reInit", sync);
    };
  }, [emblaApi, onColorChange]);

  useEffect(() => {
    if (!emblaApi) return;
    if (emblaApi.selectedScrollSnap() !== colorIdx) {
      emblaApi.scrollTo(colorIdx);
    }
  }, [emblaApi, colorIdx]);

  const go = useCallback(
    (direction: -1 | 1) => {
      if (!emblaApi) return;
      if (direction < 0) emblaApi.scrollPrev();
      else emblaApi.scrollNext();
    },
    [emblaApi],
  );

  function slideImage(entry: ProductColor, idx: number) {
    if (idx === colorIdx) {
      return gallery[imageIdx] ?? colorCover(entry);
    }
    return colorCover(entry);
  }

  if (!color) return null;

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
            Cor {String(colorIdx + 1).padStart(2, "0")} / {String(colors.length).padStart(2, "0")}
          </p>
          <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight md:text-3xl">{color.name}</h2>
        </div>
        {colors.length > 1 ? (
          <p className="hidden text-xs text-[#6A6A6A] sm:block">Deslize para ver a coleção</p>
        ) : null}
      </div>

      <div className="relative bg-[#111]">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="flex">
            {colors.map((entry, idx) => (
              <div key={entry.name} className="min-w-0 shrink-0 basis-full">
                <div className="aspect-square">
                  <img
                    src={assetUrl(slideImage(entry, idx))}
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
              onClick={() => go(-1)}
              aria-label="Grafismo anterior"
              className="absolute top-1/2 left-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/50 text-white hover:border-white hover:bg-black/70"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Próximo grafismo"
              className="absolute top-1/2 right-3 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/50 text-white hover:border-white hover:bg-black/70"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>

      <div className="no-scrollbar mt-3 flex h-14 gap-2 overflow-x-auto">
        {gallery.map((src, idx) => (
          <button
            key={src}
            type="button"
            onClick={() => setImageIdx(idx)}
            className={cn(
              "h-14 w-14 shrink-0 overflow-hidden border",
              idx === imageIdx ? "border-[#CC2222]" : "border-white/10 opacity-70 hover:opacity-100",
            )}
          >
            <img src={assetUrl(src)} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
