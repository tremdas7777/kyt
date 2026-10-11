import { SectionCarousel } from "@/components/home/SectionCarousel";
import { VisorCard } from "@/components/visors/VisorCard";
import { VISOR_PRICE, visors } from "@/data/visors";
import { formatBRL } from "@/lib/format";

/** Seção "Viseiras" da home. */
export function VisorsCarousel() {
  return (
    <SectionCarousel
      id="viseiras"
      kicker="Acessórios originais"
      title="Viseiras"
      description={`Fumê, cromada, dourada, camaleão e mais, para cada modelo KYT. Todas por ${formatBRL(VISOR_PRICE)}.`}
      link={{ label: "Ver todas", href: "/viseiras" }}
      slides={visors.map((visor) => ({ key: visor.id, node: <VisorCard visor={visor} /> }))}
      slideClass="flex-[0_0_78%] sm:flex-[0_0_46%] lg:flex-[0_0_23.5%]"
    />
  );
}
