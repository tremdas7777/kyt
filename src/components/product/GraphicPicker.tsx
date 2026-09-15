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
  if (colors.length === 0) return null;
  const selected = colors[colorIdx] ?? colors[0];

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

      <div className="no-scrollbar grid max-h-52 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5">
        {colors.map((entry, idx) => {
          const active = idx === colorIdx;
          return (
            <button
              key={entry.name}
              type="button"
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
    </div>
  );
}
