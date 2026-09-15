import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { riders } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function RidersSection() {
  const [index, setIndex] = useState(0);
  const rider = riders[index];
  if (!rider) return null;

  return (
    <section id="pilotos" className="bg-[#f3f3f3] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="mb-2 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
              #KYTRiders
            </p>
            <h2 className="font-display text-4xl font-black uppercase leading-none text-[#080808] md:text-5xl">
              Racing like no other
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIndex((value) => (value - 1 + riders.length) % riders.length)}
              aria-label="Piloto anterior"
              className="flex h-10 w-10 items-center justify-center border border-[#ddd] text-[#888] transition-colors hover:border-[#CC2222] hover:text-[#CC2222]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((value) => (value + 1) % riders.length)}
              aria-label="Próximo piloto"
              className="flex h-10 w-10 items-center justify-center border border-[#ddd] text-[#888] transition-colors hover:border-[#CC2222] hover:text-[#CC2222]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden bg-[#111]">
            <img src={rider.image} alt={`${rider.firstName} ${rider.lastName}`} className="aspect-[4/5] w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute right-6 bottom-6 left-6">
              <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
                {rider.championship}
              </p>
              <h3 className="font-display text-5xl font-black uppercase leading-none text-white">
                {rider.firstName}
                <br />
                {rider.lastName}
              </h3>
              <p className="mt-2 text-sm text-white/70">{rider.team}</p>
            </div>
          </div>

          <div>
            <p className="font-display text-sm font-bold tracking-[0.18em] text-[#6A6A6A] uppercase">
              {String(index + 1).padStart(2, "0")} / {String(riders.length).padStart(2, "0")}
            </p>
            <h3 className="mt-4 font-display text-4xl font-black uppercase leading-none text-[#080808]">
              {rider.firstName} {rider.lastName}
            </h3>
            <p className="mt-3 text-[#6A6A6A]">{rider.team}</p>
            <a
              href={`https://instagram.com/${rider.instagram.replace("@", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-[#CC2222]"
            >
              {rider.instagram}
            </a>
            <div className="mt-8 flex flex-wrap gap-2">
              {riders.map((entry, idx) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={`Piloto ${idx + 1}`}
                  onClick={() => setIndex(idx)}
                  className={cn(
                    "h-14 w-14 overflow-hidden border",
                    idx === index ? "border-[#CC2222]" : "border-transparent opacity-50 hover:opacity-100",
                  )}
                >
                  <img src={entry.image} alt={entry.lastName} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
