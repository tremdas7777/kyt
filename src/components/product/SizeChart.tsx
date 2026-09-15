import { Ruler } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { headSizes } from "@/data/catalog";
import { cn } from "@/lib/utils";

export function SizeChartButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 font-display text-[10px] font-bold tracking-widest text-[#F0F0F0]/80 uppercase underline decoration-[#CC2222] decoration-2 underline-offset-4 hover:text-white",
          className,
        )}
      >
        <Ruler className="h-3.5 w-3.5 text-[#CC2222]" aria-hidden />
        Tabela de medidas
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#0B0B0B] text-[#F0F0F0] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-black uppercase">Tabela de medidas</DialogTitle>
            <DialogDescription className="text-[#F0F0F0]/70">
              Meça a circunferência da cabeça e escolha o tamanho correspondente.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 overflow-hidden border border-white/10">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-3 py-2 font-display text-[10px] font-bold tracking-widest text-[#CC2222] uppercase">
                    Tamanho
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] font-bold tracking-widest text-[#CC2222] uppercase">
                    Circunferência da cabeça
                  </th>
                  <th className="px-3 py-2 font-display text-[10px] font-bold tracking-widest text-[#CC2222] uppercase">
                    Casco
                  </th>
                </tr>
              </thead>
              <tbody>
                {headSizes.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/10">
                    <td className="px-3 py-2.5 font-display text-sm font-bold">{entry.label}</td>
                    <td className="px-3 py-2.5 text-sm text-[#F0F0F0]/85">{entry.cm}</td>
                    <td className="px-3 py-2.5 text-sm text-[#F0F0F0]/85">{entry.shell}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2 text-sm text-[#F0F0F0]/75">
            <p className="font-display text-xs font-bold tracking-widest text-[#F0F0F0] uppercase">Como medir</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Use uma fita métrica flexível.</li>
              <li>Passe a fita ao redor da cabeça, cerca de 2 cm acima das orelhas e das sobrancelhas.</li>
              <li>Mantenha a fita justa, sem apertar, e anote a medida em centímetros.</li>
              <li>Compare com a tabela. Se ficar entre dois tamanhos, escolha o maior.</li>
            </ol>
            <p className="pt-1 text-xs text-[#6A6A6A]">
              O capacete deve ficar firme, sem folga e sem pontos de pressão. Na primeira semana de uso o forro cede
              um pouco e acomoda melhor.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
