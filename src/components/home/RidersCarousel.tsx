import { SectionCarousel } from "@/components/home/SectionCarousel";
import { riders } from "@/data/catalog";

/** Pilotos KYT em carrossel (seção clara, como a antiga, agora deslizante). */
export function RidersCarousel() {
  const slides = riders.map((rider) => ({
    key: rider.id,
    node: (
      <article className="group relative overflow-hidden bg-[#111]">
        <img src={rider.image} alt={`${rider.firstName} ${rider.lastName}`} loading="lazy" className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-[1.04]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute right-5 bottom-5 left-5">
          <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">{rider.championship}</p>
          <h3 className="font-display text-3xl font-black uppercase leading-none text-white">
            {rider.firstName}
            <br />
            {rider.lastName}
          </h3>
          <p className="mt-1 text-xs text-white/70">{rider.team}</p>
          <a
            href={`https://instagram.com/${rider.instagram.replace("@", "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-[#FF6B6B] hover:underline"
          >
            {rider.instagram}
          </a>
        </div>
      </article>
    ),
  }));

  return (
    <SectionCarousel
      id="pilotos"
      light
      kicker="#KYTRiders"
      title="Racing like no other"
      description="Os pilotos que usam KYT no MotoGP, Moto2, Moto3 e no Mundial de Superbike."
      slides={slides}
      slideClass="flex-[0_0_70%] sm:flex-[0_0_40%] lg:flex-[0_0_23.5%]"
      autoplayMs={5000}
    />
  );
}
