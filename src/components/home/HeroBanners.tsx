import { Link } from "@tanstack/react-router";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { assetUrl } from "@/data/catalog";
import { bannerPrice, banners, type Banner, type BannerTheme } from "@/data/banners";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

const AUTOPLAY_MS = 6500;

const THEME: Record<
  BannerTheme,
  { bg: string; ghost: string; kicker: string; text: string; muted: string; glow: string }
> = {
  red: {
    bg: "bg-[radial-gradient(120%_90%_at_85%_30%,#5a0d0d_0%,#1a0505_45%,#080808_100%)]",
    ghost: "text-white/[0.06]",
    kicker: "text-[#FF4A4A]",
    text: "text-[#F0F0F0]",
    muted: "text-[#F0F0F0]/75",
    glow: "bg-[#CC2222]/35",
  },
  carbon: {
    bg: "bg-[radial-gradient(120%_90%_at_80%_30%,#2a2a2a_0%,#121212_45%,#080808_100%)]",
    ghost: "text-white/[0.05]",
    kicker: "text-[#CC2222]",
    text: "text-[#F0F0F0]",
    muted: "text-[#F0F0F0]/70",
    glow: "bg-white/15",
  },
  blue: {
    bg: "bg-[radial-gradient(120%_90%_at_85%_30%,#0f2a4a_0%,#0a1220_45%,#080808_100%)]",
    ghost: "text-white/[0.06]",
    kicker: "text-[#5BB8FF]",
    text: "text-[#F0F0F0]",
    muted: "text-[#F0F0F0]/75",
    glow: "bg-[#2E86FF]/30",
  },
  white: {
    bg: "bg-[radial-gradient(120%_90%_at_85%_30%,#ffffff_0%,#e9e9e9_45%,#d6d6d6_100%)]",
    ghost: "text-black/[0.06]",
    kicker: "text-[#CC2222]",
    text: "text-[#0a0a0a]",
    muted: "text-[#0a0a0a]/70",
    glow: "bg-[#CC2222]/20",
  },
};

export function HeroBanners() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: banners.length > 1, duration: 28 });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const sync = () => setIndex(emblaApi.selectedScrollSnap());
    sync();
    emblaApi.on("select", sync);
    emblaApi.on("reInit", sync);
    return () => {
      emblaApi.off("select", sync);
      emblaApi.off("reInit", sync);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || paused || banners.length <= 1) return;
    const timer = window.setInterval(() => emblaApi.scrollNext(), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [emblaApi, paused, index]);

  const go = useCallback(
    (direction: -1 | 1) => {
      if (!emblaApi) return;
      if (direction < 0) emblaApi.scrollPrev();
      else emblaApi.scrollNext();
    },
    [emblaApi],
  );

  return (
    <section
      aria-label="Destaques KYT"
      className="relative w-full overflow-hidden bg-[#080808] pt-16 lg:pt-[72px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {banners.map((banner, i) => (
            <BannerSlide key={banner.id} banner={banner} active={i === index} />
          ))}
        </div>
      </div>

      {banners.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Banner anterior"
            onClick={() => go(-1)}
            className="absolute top-1/2 left-3 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/40 text-white backdrop-blur-sm hover:border-white hover:bg-black/60 md:flex"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            aria-label="Próximo banner"
            onClick={() => go(1)}
            className="absolute top-1/2 right-3 z-20 hidden h-12 w-12 -translate-y-1/2 items-center justify-center border border-white/20 bg-black/40 text-white backdrop-blur-sm hover:border-white hover:bg-black/60 md:flex"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute inset-x-0 bottom-4 z-20 flex items-center justify-center gap-2">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                aria-label={`Ir para o banner ${i + 1}`}
                aria-current={i === index}
                onClick={() => emblaApi?.scrollTo(i)}
                className={cn(
                  "h-1.5 transition-all",
                  i === index ? "w-10 bg-[#CC2222]" : "w-5 bg-white/30 hover:bg-white/60",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function BannerSlide({ banner, active }: { banner: Banner; active: boolean }) {
  const theme = THEME[banner.theme];
  const price = bannerPrice(banner);

  return (
    <div className={cn("relative min-w-0 flex-[0_0_100%]", theme.bg)}>
      {/* Faixa diagonal decorativa */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-1/2 skew-x-[-12deg] bg-white/[0.03]" />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute right-[-2%] bottom-[8%] font-display text-[26vw] leading-none font-black tracking-tighter uppercase select-none lg:text-[17vw]",
          theme.ghost,
        )}
      >
        {banner.ghost}
      </div>

      <div className="relative z-10 mx-auto grid min-h-[72svh] w-full max-w-7xl grid-cols-1 items-center gap-6 px-6 pt-10 pb-16 md:px-20 lg:min-h-[76svh] lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-6 xl:px-10">
        <div className="order-2 lg:order-1">
          <p className={cn("mb-3 font-display text-xs font-bold tracking-[0.18em] uppercase", theme.kicker)}>
            {banner.kicker}
          </p>
          <h2
            className={cn("font-display font-black uppercase leading-[0.9]", theme.text)}
            style={{ fontSize: "clamp(2.8rem, 7.5vw, 6rem)" }}
          >
            {banner.title}
          </h2>
          <p className={cn("mt-4 max-w-xl font-sans text-base md:text-lg", theme.muted)}>{banner.subtitle}</p>

          {price ? (
            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={cn("font-display text-3xl font-black md:text-4xl", theme.text)}>
                {formatBRL(price.pix)}
              </span>
              <span className={cn("font-sans text-sm", theme.muted)}>à vista no PIX</span>
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap gap-3">
            <BannerLink href={banner.cta.href} className="kyt-btn kyt-btn-primary">
              {banner.cta.label}
            </BannerLink>
            {banner.secondaryCta ? (
              <BannerLink
                href={banner.secondaryCta.href}
                className={cn(
                  "kyt-btn kyt-btn-outline",
                  banner.theme === "white" && "border-black/60 text-[#0a0a0a] hover:border-[#CC2222] hover:text-[#CC2222]",
                )}
              >
                {banner.secondaryCta.label}
              </BannerLink>
            ) : null}
          </div>
        </div>

        <div className="relative order-1 flex items-center justify-center lg:order-2">
          <div className={cn("absolute h-[55%] w-[55%] rounded-full blur-3xl", theme.glow)} />
          <img
            src={assetUrl(banner.image)}
            alt={banner.imageAlt}
            loading={active ? "eager" : "lazy"}
            decoding="async"
            className={cn(
              "relative w-[78%] max-w-[560px] object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.6)] transition-transform duration-700 lg:w-full",
              active ? "scale-100" : "scale-95",
            )}
          />
        </div>
      </div>
    </div>
  );
}

function BannerLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  if (href.startsWith("/#") || href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}
