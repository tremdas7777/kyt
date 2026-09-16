import { ChevronDown } from "lucide-react";

export function Hero() {
  return (
    <section className="relative flex h-[100svh] items-end overflow-hidden">
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        src="https://www.capacetekyt.com.br/videos/hero-bg.mp4"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/75 to-[#080808]/35" />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-20 lg:px-10 lg:pb-24">
        <p
          className="mb-4 font-display text-xs font-bold tracking-[0.18em] text-[#CC2222] uppercase"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,0.8)" }}
        >
          Racing DNA.
        </p>
        <h1
          className="font-display font-black uppercase leading-[0.9] text-[#F0F0F0]"
          style={{
            fontSize: "clamp(4rem, 9vw, 9rem)",
            textShadow: "0 4px 24px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.7)",
          }}
        >
          World Class
          <br />
          Helmet
        </h1>
        <p className="mt-6 max-w-xl font-sans text-lg text-[#F0F0F0]/80 md:text-xl">
          Capacetes desenvolvidos nas pistas do MotoGP, agora ao seu alcance
        </p>
        <div className="mt-10">
          <a href="#produtos" className="kyt-btn kyt-btn-primary">
            Conheça os Modelos
          </a>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-white/70">
        <ChevronDown className="h-7 w-7 animate-bounce" />
      </div>
    </section>
  );
}
