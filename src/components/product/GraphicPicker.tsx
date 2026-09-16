import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { assetUrl, colorCover, type Product } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function GraphicPicker({
  product,
  colorIdx,
  onSelect,
}: {
  product: Product;
  colorIdx: number;
  onSelect: (index: number) => void;
}) {
  const colors = product.colors;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const selected = colors[colorIdx] ?? colors[0];

  function updateOverflow() {
    const el = scrollerRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
    setMoreBelow(remaining > 12);
  }

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    el.addEventListener("scroll", updateOverflow, { passive: true });
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateOverflow);
      observer.disconnect();
    };
  }, [colors.length]);

  useEffect(() => {
    const active = scrollerRef.current?.querySelector<HTMLElement>("[data-active-color='true']");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
    updateOverflow();
  }, [colorIdx]);

  if (colors.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">Escolher cor</p>
        <span className="shrink-0 font-display text-[10px] font-bold tracking-widest text-[#6A6A6A] uppercase">
          {String(colorIdx + 1).padStart(2, "0")} / {String(colors.length).padStart(2, "0")}
        </span>
      </div>
      <p className="mb-3 truncate font-display text-sm font-bold uppercase text-white">
        {selected?.name ?? "Escolha a cor ou o desenho"}
      </p>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="color-picker-scroll grid max-h-56 grid-cols-4 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-5"
        >
          {colors.map((entry, idx) => {
            const active = idx === colorIdx;
            return (
              <button
                key={entry.name}
                type="button"
                data-active-color={active ? "true" : undefined}
                onClick={() => onSelect(idx)}
                className={cn(
                  "group border bg-[#111] p-1 text-left",
                  active ? "border-[#CC2222]" : "border-white/10 hover:border-white/35",
                )}
              >
                <span className="block aspect-square overflow-hidden bg-[#0a0a0a]">
                  <img
                    src={assetUrl(colorCover(entry))}
                    alt=""
                    className={cn(
                      "h-full w-full object-contain",
                      product.flipX && "scale-x-[-1]",
                      !active && "opacity-80 group-hover:opacity-100",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "mt-1 block truncate font-display text-[9px] font-bold uppercase",
                    active ? "text-white" : "text-[#8A8A8A] group-hover:text-white",
                  )}
                >
                  {entry.name}
                </span>
              </button>
            );
          })}
        </div>

        {moreBelow ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center bg-gradient-to-t from-[#111] via-[#111]/90 to-transparent pt-10 pb-2">
            <ChevronDown className="h-4 w-4 animate-bounce text-[#CC2222]" />
            <p className="font-display text-[10px] font-bold tracking-[0.14em] text-white uppercase">
              Role para ver mais cores
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
