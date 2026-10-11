import { CHECKOUT_TOTAL_CAP, INSTALLMENT_FEE, INSTALLMENTS, pixPrice } from "@/data/catalog";
import { formatBRL } from "@/lib/format";
import { useCardEnabled } from "@/lib/payment-options";
import { STOREFRONT_ALLOWS_CARD } from "@/lib/payment-types";

export function PriceLines({
  price,
  size = "md",
}: {
  price: number;
  size?: "sm" | "md" | "lg";
}) {
  const cardEnabled = STOREFRONT_ALLOWS_CARD && useCardEnabled();
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
      <p className="mt-1 text-sm text-[#CC2222]">à vista no PIX</p>
      {cardEnabled ? (
        <p className="mt-1 text-sm text-[#6A6A6A]">
          ou em até {INSTALLMENTS}x de{" "}
          {formatBRL(Math.min(price * (1 + INSTALLMENT_FEE), CHECKOUT_TOTAL_CAP) / INSTALLMENTS)} no cartão (taxa 6%)
        </p>
      ) : null}
    </div>
  );
}
