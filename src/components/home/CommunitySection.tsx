import { communityPhotos } from "@/data/catalog";

export function CommunitySection() {
  return (
    <section className="bg-[#080808] py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="mb-2 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
          #KYTRiders · #KYTFamily
        </p>
        <h2
          className="font-display font-black uppercase leading-none text-[#F0F0F0]"
          style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)" }}
        >
          Seu vídeo pode estar
          <br />
          na nossa página
        </h2>
        <p className="mt-6 max-w-sm font-sans text-base leading-relaxed text-[#6A6A6A]">
          Consumidores, influenciadores e apaixonados por moto — todos fazem parte da família KYT. Marque{" "}
          <span className="text-[#F0F0F0]">@capacetekyt</span> ou use{" "}
          <span className="text-[#F0F0F0]">#KYTFamily</span> no Instagram e no TikTok.
        </p>
        <div className="mt-6 flex gap-3">
          <a
            href="https://instagram.com/capacetekyt"
            target="_blank"
            rel="noopener noreferrer"
            className="kyt-btn kyt-btn-outline"
          >
            Instagram
          </a>
          <a
            href="https://tiktok.com/@capacete.kyt"
            target="_blank"
            rel="noopener noreferrer"
            className="kyt-btn kyt-btn-outline"
          >
            TikTok
          </a>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {communityPhotos.map((src, idx) => (
            <img
              key={src}
              src={src}
              alt={`KYT Community photo ${idx + 1}`}
              className="aspect-square w-full object-cover"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
