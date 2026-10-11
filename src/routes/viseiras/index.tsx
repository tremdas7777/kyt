import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { VisorCard } from "@/components/visors/VisorCard";
import { VISOR_PRICE, visors } from "@/data/visors";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/viseiras/")({
  head: () => ({
    meta: [
      { title: "Viseiras originais KYT | KYT Capacetes Brasil" },
      {
        name: "description",
        content: "Viseiras originais KYT para TT-Course, TT-Revo, KX1-GP, R2R, Striker, NZ-Race, TTR-Jet e D-City. Fumê, cromada, dourada, camaleão e mais.",
      },
    ],
  }),
  component: VisorsPage,
});

function VisorsPage() {
  const [model, setModel] = useState<string>("todas");
  const list = useMemo(() => (model === "todas" ? visors : visors.filter((visor) => visor.id === model)), [model]);
  const totalColors = visors.reduce((sum, visor) => sum + visor.colors.length, 0);

  return (
    <section className="pt-28 pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="font-display text-xs font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">Início / Viseiras</p>
        <h1 className="mt-3 font-display text-5xl font-black uppercase leading-none md:text-6xl">Viseiras originais</h1>
        <p className="mt-3 max-w-2xl text-[#6A6A6A]">
          {visors.length} modelos e {totalColors} opções de cor, todas por {formatBRL(VISOR_PRICE)}. Policarbonato de alta resistência, anti-risco e
          preparadas para Pinlock®. Escolha a viseira do seu capacete.
        </p>

        <div className="no-scrollbar mt-8 flex gap-2 overflow-x-auto pb-1">
          {[{ id: "todas", label: "Todas" }, ...visors.map((visor) => ({ id: visor.id, label: visor.model }))].map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setModel(entry.id)}
              className={cn(
                "shrink-0 border px-4 py-2 font-display text-xs font-bold tracking-[0.12em] uppercase",
                model === entry.id ? "border-[#CC2222] bg-[#CC2222] text-white" : "border-white/10 text-[#6A6A6A] hover:text-white",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((visor) => (
            <div key={visor.id}>
              <VisorCard visor={visor} />
              <p className="mt-2 text-xs text-[#6A6A6A]">
                Serve no capacete {visor.fits.join(", ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
