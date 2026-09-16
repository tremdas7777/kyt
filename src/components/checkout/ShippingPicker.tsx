import { MercadoFullBadge } from "@/components/checkout/MercadoFullBadge";
import { formatBRL } from "@/lib/format";
import { SHIPPING_OPTIONS, type ShippingMethod } from "@/lib/shipping";
import { cn } from "@/lib/utils";

export function ShippingPicker({
  value,
  onChange,
}: {
  value: ShippingMethod;
  onChange: (value: ShippingMethod) => void;
}) {
  return (
    <div className="grid gap-2">
      {SHIPPING_OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            aria-label={option.id === "full" ? `Envio Full, ${option.eta}` : undefined}
            className={cn(
              "flex w-full items-center justify-between gap-3 border px-4 py-3 text-left",
              selected ? "border-[#CC2222] bg-[#CC2222]/10" : "border-white/15 hover:border-white/40",
            )}
          >
            <span className="min-w-0">
              {option.id === "full" ? (
                <MercadoFullBadge className="h-6" />
              ) : (
                <span className="font-display text-sm font-bold uppercase">{option.title}</span>
              )}
              <span className="mt-1 block text-xs text-[#6A6A6A]">{option.eta}</span>
            </span>
            <span className="shrink-0 font-display text-sm font-black">
              {option.price > 0 ? formatBRL(option.price) : "Grátis"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
