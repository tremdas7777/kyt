import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <div className="min-h-screen bg-[#080808] text-[#F0F0F0]">
        <Header />
        <main>{children}</main>
        <Footer />
        <CartDrawer />
      </div>
    </CartProvider>
  );
}
