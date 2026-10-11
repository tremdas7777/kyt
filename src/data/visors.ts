// Viseiras originais KYT (catálogo do site oficial KYT Brasil, out/2026). Fotos em public/images/viseiras.
// Preço de venda único: VISOR_PRICE (offers.ts). `officialPrice` é o preço de tabela do site oficial (mostrado riscado).
import { VISOR_PRICE } from "@/data/offers";

export type VisorColor = {
  /** Nome exibido (ex.: "Preto"). */
  name: string;
  slug: string;
  image: string;
  officialPrice: number;
};

export type Visor = {
  /** Usado na URL: /viseiras/<id>. No carrinho o productId é `viseira-<id>`. */
  id: string;
  model: string;
  name: string;
  /** Capacetes da loja em que a viseira encaixa (ids de products.json). */
  compatible: string[];
  /** Nomes dos capacetes compatíveis, para exibir (inclui modelos fora da loja). */
  fits: string[];
  description: string;
  gallery: string[];
  colors: VisorColor[];
};

export { VISOR_PRICE };

export const VISOR_CART_PREFIX = "viseira-";

const VISOR_DESCRIPTION =
  "As viseiras originais KYT foram desenvolvidas para garantir segurança, conforto e excelente visibilidade durante a pilotagem. Produzidas em policarbonato de alta resistência, oferecem proteção confiável contra impactos e alta durabilidade no uso diário. O encaixe preciso mantém a performance original do capacete, preservando a vedação e a aerodinâmica do modelo. Contam com tratamento anti-risco e preparação para Pinlock®, que ajuda a reduzir o embaçamento e garante visão nítida em diferentes condições climáticas. Use apenas viseiras originais no seu capacete e preserve a sua segurança.";

export const visors: Visor[] = [
  {
    id: "tt-course",
    model: "TT-Course",
    name: "Viseira KYT TT-Course",
    compatible: ["tt-course"],
    fits: ["TT-Course"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/tt-course/galeria-1.webp"],
    colors: [
      { name: "Preto", slug: "preto", image: "/images/viseiras/tt-course/preto.webp", officialPrice: 249 },
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/tt-course/transparente.webp", officialPrice: 159 },
      { name: "Cromada", slug: "cromada", image: "/images/viseiras/tt-course/cromada.webp", officialPrice: 259 },
      { name: "Dourado", slug: "dourado", image: "/images/viseiras/tt-course/dourado.webp", officialPrice: 259 },
      { name: "Vermelho", slug: "vermelho", image: "/images/viseiras/tt-course/vermelho.webp", officialPrice: 259 },
      { name: "Azul escuro", slug: "azul-escuro", image: "/images/viseiras/tt-course/azul-escuro.webp", officialPrice: 259 },
      { name: "Verde claro", slug: "verde-claro", image: "/images/viseiras/tt-course/verde-claro.webp", officialPrice: 259 },
      { name: "Camaleão", slug: "camaleao", image: "/images/viseiras/tt-course/camaleao.webp", officialPrice: 259 },
    ],
  },
  {
    id: "tt-revo",
    model: "TT-Revo",
    name: "Viseira KYT TT-Revo",
    compatible: ["tt-revo"],
    fits: ["TT-Revo"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/tt-revo/galeria-1.webp"],
    colors: [
      { name: "Preto", slug: "preto", image: "/images/viseiras/tt-revo/preto.webp", officialPrice: 239 },
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/tt-revo/transparente.webp", officialPrice: 239 },
      { name: "Dourado", slug: "dourado", image: "/images/viseiras/tt-revo/dourado.webp", officialPrice: 279 },
      { name: "Azul escuro", slug: "azul-escuro", image: "/images/viseiras/tt-revo/azul-escuro.webp", officialPrice: 279 },
    ],
  },
  {
    id: "kx1-gp",
    model: "KX1-GP",
    name: "Viseira KYT KX1-GP",
    compatible: ["kx1-gp"],
    fits: ["KX1-GP"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/kx1-gp/galeria-1.webp"],
    colors: [
      { name: "Preto", slug: "preto", image: "/images/viseiras/kx1-gp/preto.webp", officialPrice: 749 },
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/kx1-gp/transparente.webp", officialPrice: 749 },
      { name: "Dourado", slug: "dourado", image: "/images/viseiras/kx1-gp/dourado.webp", officialPrice: 849 },
      { name: "Vermelho", slug: "vermelho", image: "/images/viseiras/kx1-gp/vermelho.webp", officialPrice: 849 },
      { name: "Azul escuro", slug: "azul-escuro", image: "/images/viseiras/kx1-gp/azul-escuro.webp", officialPrice: 849 },
      { name: "Camaleão", slug: "camaleao", image: "/images/viseiras/kx1-gp/camaleao.webp", officialPrice: 849 },
    ],
  },
  {
    id: "r2r",
    model: "R2R",
    name: "Viseira KYT R2R",
    compatible: ["r2r"],
    fits: ["R2R"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/r2r/galeria-1.webp"],
    colors: [
      { name: "Preto", slug: "preto", image: "/images/viseiras/r2r/preto.webp", officialPrice: 249 },
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/r2r/transparente.webp", officialPrice: 199 },
      { name: "Cromada", slug: "cromada", image: "/images/viseiras/r2r/cromada.webp", officialPrice: 289 },
      { name: "Dourado", slug: "dourado", image: "/images/viseiras/r2r/dourado.webp", officialPrice: 289 },
      { name: "Azul escuro", slug: "azul-escuro", image: "/images/viseiras/r2r/azul-escuro.webp", officialPrice: 289 },
      { name: "Camaleão", slug: "camaleao", image: "/images/viseiras/r2r/camaleao.webp", officialPrice: 289 },
    ],
  },
  {
    id: "striker-nz-race",
    model: "Striker / NZ-Race / NX-Race / NF-R",
    name: "Viseira KYT Striker / NZ-Race / NX-Race / NF-R",
    compatible: ["striker", "nz-race"],
    fits: ["Striker", "NZ-Race", "NX-Race", "NF-R"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/striker-nz-race/galeria-1.webp"],
    colors: [
      { name: "Preto", slug: "preto", image: "/images/viseiras/striker-nz-race/preto.webp", officialPrice: 249 },
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/striker-nz-race/transparente.webp", officialPrice: 199 },
      { name: "Cromada", slug: "cromada", image: "/images/viseiras/striker-nz-race/cromada.webp", officialPrice: 279 },
      { name: "Dourado", slug: "dourado", image: "/images/viseiras/striker-nz-race/dourado.webp", officialPrice: 279 },
      { name: "Vermelho", slug: "vermelho", image: "/images/viseiras/striker-nz-race/vermelho.webp", officialPrice: 279 },
      { name: "Azul escuro", slug: "azul-escuro", image: "/images/viseiras/striker-nz-race/azul-escuro.webp", officialPrice: 279 },
      { name: "Verde claro", slug: "verde-claro", image: "/images/viseiras/striker-nz-race/verde-claro.webp", officialPrice: 279 },
      { name: "Camaleão", slug: "camaleao", image: "/images/viseiras/striker-nz-race/camaleao.webp", officialPrice: 279 },
    ],
  },
  {
    id: "ttr-jet",
    model: "TTR-Jet",
    name: "Viseira KYT TTR-Jet",
    compatible: ["ttr-jet"],
    fits: ["TTR-Jet"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/ttr-jet/galeria-1.webp"],
    colors: [
      { name: "Preto", slug: "preto", image: "/images/viseiras/ttr-jet/preto.webp", officialPrice: 199 },
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/ttr-jet/transparente.webp", officialPrice: 199 },
      { name: "Dourado", slug: "dourado", image: "/images/viseiras/ttr-jet/dourado.webp", officialPrice: 249 },
      { name: "Vermelho", slug: "vermelho", image: "/images/viseiras/ttr-jet/vermelho.webp", officialPrice: 249 },
      { name: "Azul escuro", slug: "azul-escuro", image: "/images/viseiras/ttr-jet/azul-escuro.webp", officialPrice: 249 },
      { name: "Azul claro", slug: "azul-claro", image: "/images/viseiras/ttr-jet/azul-claro.webp", officialPrice: 249 },
      { name: "Verde claro", slug: "verde-claro", image: "/images/viseiras/ttr-jet/verde-claro.webp", officialPrice: 249 },
    ],
  },
  {
    id: "d-city",
    model: "D-City",
    name: "Viseira KYT D-City",
    compatible: ["d-city"],
    fits: ["D-City"],
    description: VISOR_DESCRIPTION,
    gallery: ["/images/viseiras/d-city/galeria-1.webp"],
    colors: [
      { name: "Transparente", slug: "transparente", image: "/images/viseiras/d-city/transparente.webp", officialPrice: 159 },
    ],
  },
];

export function getVisor(id: string): Visor | undefined {
  return visors.find((visor) => visor.id === id);
}

/** Viseira a partir do productId do carrinho (`viseira-<id>`). */
export function visorFromCartId(productId: string): Visor | undefined {
  return productId.startsWith(VISOR_CART_PREFIX) ? getVisor(productId.slice(VISOR_CART_PREFIX.length)) : undefined;
}

/** Viseiras que servem num capacete da loja. */
export function visorsForHelmet(helmetId: string): Visor[] {
  return visors.filter((visor) => visor.compatible.includes(helmetId));
}

export function visorColor(visor: Visor, slug?: string): VisorColor {
  return visor.colors.find((color) => color.slug === slug) ?? visor.colors[0]!;
}
