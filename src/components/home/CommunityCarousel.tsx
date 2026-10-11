import { SectionCarousel } from "@/components/home/SectionCarousel";
import { communityPhotos } from "@/data/catalog";

export function CommunityCarousel() {
  const slides = communityPhotos.map((src, idx) => ({
    key: src,
    node: <img src={src} alt={`KYT Family foto ${idx + 1}`} loading="lazy" className="aspect-square w-full object-cover" />,
  }));

  return (
    <SectionCarousel
      kicker="#KYTRiders · #KYTFamily"
      title={
        <>
          Seu vídeo pode estar
          <br />
          na nossa página
        </>
      }
      description={
        <>
          Consumidores, influenciadores e apaixonados por moto — todos fazem parte da família KYT. Marque{" "}
          <span className="text-[#F0F0F0]">@capacetekyt</span> ou use <span className="text-[#F0F0F0]">#KYTFamily</span> no Instagram e no TikTok.
        </>
      }
      slides={slides}
      slideClass="flex-[0_0_60%] sm:flex-[0_0_32%] lg:flex-[0_0_19%]"
      autoplayMs={4000}
      className="pb-10"
    />
  );
}
