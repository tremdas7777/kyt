import { cn } from "@/lib/utils";

export function MercadoFullBadge({ className }: { className?: string }) {
  return (
    <img
      src="/envio-full.png"
      alt="Envio Full"
      className={cn("inline-block h-5 w-auto shrink-0 object-contain", className)}
    />
  );
}
