import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Sobre", href: "/#sobre" },
  { label: "Produtos", href: "/produtos" },
  { label: "Viseiras", href: "/viseiras" },
  { label: "Pilotos", href: "/#pilotos" },
  { label: "Contato", href: "/contato" },
];

export function Header() {
  const { count, openCart, hydrated } = useCart();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const badge = hydrated ? count : 0;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
          scrolled || open ? "bg-[#080808]/95 backdrop-blur-md" : "bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6 lg:px-10">
          <Link to="/" className="relative z-50 shrink-0" onClick={() => window.scrollTo(0, 0)}>
            <img src="/logo-kyt.svg" alt="KYT Capacetes Brasil" className="h-8 w-auto sm:h-10" />
          </Link>

          <nav className="hidden items-center gap-8 lg:flex">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="font-display text-sm font-bold tracking-[0.16em] uppercase text-[#F0F0F0] opacity-80 transition-opacity hover:opacity-100"
              >
                {item.label}
              </a>
            ))}
            <CartButton count={badge} onClick={openCart} />
          </nav>

          <div className="relative z-50 flex items-center gap-1 lg:hidden">
            <CartButton count={badge} onClick={openCart} />
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex h-11 w-11 items-center justify-center text-[#F0F0F0]"
              aria-label={open ? "Fechar menu" : "Abrir menu"}
            >
              {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#080808] pt-24 transition-opacity duration-300 lg:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        <nav className="flex flex-col gap-2 px-6">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="py-3 font-display text-3xl font-black uppercase tracking-wide text-[#F0F0F0]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  );
}

function CartButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex h-11 w-11 items-center justify-center text-[#F0F0F0] transition-opacity hover:opacity-80"
      aria-label="Abrir carrinho"
    >
      <ShoppingBag className="h-5 w-5" />
      {count > 0 ? (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center bg-[#CC2222] px-1 font-display text-[10px] font-bold text-white">
          {count}
        </span>
      ) : null}
    </button>
  );
}
