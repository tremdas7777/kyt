import { INSTALLMENTS, pixPrice } from "@/data/catalog";
import { formatBRL } from "@/lib/format";

export function PriceLines({
  price,
  size = "md",
}: {
  price: number;
  size?: "sm" | "md" | "lg";
}) {
  const pix = pixPrice(price);
  const titleClass =
    size === "lg"
      ? "font-display text-4xl font-black text-white"
      : size === "sm"
        ? "font-display text-xl font-bold"
        : "font-display text-2xl font-black";

  return (
    <div>
      <p className={titleClass}>{formatBRL(pix)}</p>
      <p className="mt-1 text-sm text-[#CC2222]">no PIX com 10% OFF</p>
      <p className="mt-1 text-sm text-[#6A6A6A]">
        ou {INSTALLMENTS}x de {formatBRL(price / INSTALLMENTS)} sem juros no cartão
      </p>
    </div>
  );
}
