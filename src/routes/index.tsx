import { createFileRoute } from "@tanstack/react-router";
import { useLayoutEffect } from "react";

import { CommunitySection } from "@/components/home/CommunitySection";
import { DnaSection } from "@/components/home/DnaSection";
import { Hero } from "@/components/home/Hero";
import { Kx1Banner } from "@/components/home/Kx1Banner";
import { ProductsShowcase } from "@/components/home/ProductsShowcase";
import { RidersSection } from "@/components/home/RidersSection";
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
      <Hero />
      <ProductsShowcase />
      <Kx1Banner />
      <DnaSection />
      <RidersSection />
      <CommunitySection />
    </>
  );
}
