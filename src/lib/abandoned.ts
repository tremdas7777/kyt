import { formatBRL, onlyDigits } from "@/lib/format";
import type { AbandonedCart, LiveCartLine } from "@/lib/tracking-types";

export function cartContactName(cart: Pick<AbandonedCart, "customerName" | "customerEmail" | "customerPhone" | "device">) {
  const name = cart.customerName.trim();
  if (name) return name;
  if (cart.customerEmail.trim()) return cart.customerEmail;
  if (cart.customerPhone.trim()) return cart.customerPhone;
  return cart.device === "mobile" ? "Visitante no celular" : "Visitante no desktop";
}

export function cartItemsLabel(items: LiveCartLine[]) {
  if (!items.length) return "Itens no carrinho";
  return items.map((item) => `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(", ");
}

export function whatsappCartHref(cart: AbandonedCart) {
  const digits = onlyDigits(cart.customerPhone);
  if (digits.length < 10) return "";
  const e164 = digits.startsWith("55") ? digits : `55${digits}`;
  const first = cart.customerName.trim().split(/\s+/)[0] ?? "";
  const hello = first ? `Olá ${first}` : "Olá";
  const text = `${hello}, vi que você deixou ${cartItemsLabel(cart.cartItems)} no carrinho da KYT (${formatBRL(cart.cartValue)}). Posso te ajudar a concluir o pedido?`;
  return `https://wa.me/${e164}?text=${encodeURIComponent(text)}`;
}
