import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/** Páginas de compra usam um layout focado (só logo + rodapé de segurança), como o checkout da Aidex. */
const FOCUSED_PREFIXES = ["/checkout", "/pedido/", "/obrigado/", "/upsell/"];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const focused = FOCUSED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (focused) return <CheckoutShell>{children}</CheckoutShell>;

  return (
    <div className="min-h-screen bg-[#080808] text-[#F0F0F0]">
      <Header />
      <main>{children}</main>
      <Footer />
      <CartDrawer />
    </div>
  );
}
