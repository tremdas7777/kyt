import { Link } from "@tanstack/react-router";

import { getProduct } from "@/data/catalog";
import { formatBRL } from "@/lib/format";

export function Kx1Banner() {
  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-[#050505]">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover opacity-50"
        src="https://www.kyteurope.com/wp-content/uploads/2023/11/KX-1-kyt.mp4"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/92 via-[#050505]/60 to-[#050505]/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-[90vh] max-w-7xl items-center px-6 py-20 lg:px-10">
        <div className="max-w-lg">
          <p className="mb-3 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
            Lançamento
          </p>
          <h2 className="font-display text-6xl font-black uppercase leading-none md:text-7xl">KX1-GP</h2>
          <p className="mt-6 font-display text-2xl font-bold text-[#F0F0F0]">
            O capacete do MotoGP. Ao seu alcance.
          </p>
          <p className="mt-4 max-w-sm font-sans text-sm leading-relaxed text-[#6A6A6A]">
            Casco Tri-Fiber composite em kevlar, carbono e fibra de vidro. Homologação FIM Racing. O mesmo
            capacete de Enea Bastianini no MotoGP 2025.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["FIM Racing", "Tri-Fiber Shell", "Aero CFD", "Óptica Classe 1"].map((tag) => (
              <span
                key={tag}
                className="border border-white/15 px-3 py-1.5 font-display text-[11px] font-bold tracking-[0.14em] text-white/80 uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="mt-8 font-display text-3xl font-black">{formatBRL(getProduct("kx1-gp")?.price ?? 472.1)}</p>
          <div className="mt-6">
            <Link to="/produtos/$slug" params={{ slug: "kx1-gp" }} className="kyt-btn kyt-btn-primary">
              Ver produto
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
