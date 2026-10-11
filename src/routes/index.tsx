import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect } from "react";

import { BenefitsStrip } from "@/components/home/BenefitsStrip";
import { CommunityCarousel } from "@/components/home/CommunityCarousel";
import { DnaSection } from "@/components/home/DnaSection";
import { HeroBanners } from "@/components/home/HeroBanners";
import { Kx1Banner } from "@/components/home/Kx1Banner";
import { ProductCarousel } from "@/components/home/ProductCarousel";
import { ProductsShowcase } from "@/components/home/ProductsShowcase";
import { RidersCarousel } from "@/components/home/RidersCarousel";
import { VisorsCarousel } from "@/components/home/VisorsCarousel";
import { startHomeScrollLock } from "@/lib/home-scroll";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KYT Capacetes Brasil | World Class Helmet" },
      {
        name: "description",
        content:
          "Capacetes KYT desenvolvidos nas pistas do MotoGP. Compre TT-Course, TT-Revo, KX1-GP e toda a linha oficial no Brasil.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  useLayoutEffect(() => startHomeScrollLock(), []);

  return (
    <>
      <HeroBanners />
      <BenefitsStrip />
      <ProductCarousel category="Sport Touring" />
      <ProductCarousel category="Racing" />
      <ProductCarousel category="City" />
      <VisorsCarousel />
      <ProductsShowcase />
      <Kx1Banner />
      <DnaSection />
      <RidersCarousel />
      <CommunityCarousel />
    </>
  );
}
