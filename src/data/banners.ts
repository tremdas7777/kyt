import { getProduct, pixPrice } from "@/data/catalog";

export type BannerTheme = "red" | "carbon" | "blue" | "white";

export type Banner = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  /** Linha de preço opcional (ex.: "a partir de"). */
  priceProductId?: string;
  cta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Foto do capacete (fundo transparente) em public/. */
  image: string;
  imageAlt: string;
  /** Texto fantasma gigante atrás do capacete. */
  ghost: string;
  theme: BannerTheme;
};

/** Banners próprios da KYT. Edite aqui para trocar os slides do topo da home. */
export const banners: Banner[] = [
  {
    id: "tt-course",
    kicker: "Sport Touring · Réplicas oficiais",
    title: "TT-Course",
    subtitle: "O grafismo dos pilotos do MotoGP e do Mundial de Superbike, pronto para a sua rotina.",
    priceProductId: "tt-course",
    cta: { label: "Ver TT-Course", href: "/produtos/tt-course" },
    secondaryCta: { label: "Todos os modelos", href: "/produtos" },
    image: "/images/produtos/tt-course/gino-rea-replica/1.webp",
    imageAlt: "Capacete KYT TT-Course Gino Rea",
    ghost: "TT-COURSE",
    theme: "red",
  },
  {
    id: "kx1-gp",
    kicker: "Lançamento · Homologação FIM Racing",
    title: "KX1-GP",
    subtitle: "Casco Tri-Fiber em kevlar, carbono e fibra de vidro. O mesmo capacete de Enea Bastianini no MotoGP.",
    priceProductId: "kx1-gp",
    cta: { label: "Ver KX1-GP", href: "/produtos/kx1-gp" },
    image: "/images/produtos/kx1-gp/bastianini-rep-2023/1.webp",
    imageAlt: "Capacete KYT KX1-GP Bastianini",
    ghost: "KX1-GP",
    theme: "carbon",
  },
  {
    id: "tt-revo",
    kicker: "Sport Touring · Top de linha",
    title: "TT-Revo",
    subtitle: "Viseira solar interna, ventilação de pista e as pinturas Leopard, Bulega e Diogo Moreira.",
    priceProductId: "tt-revo",
    cta: { label: "Ver TT-Revo", href: "/produtos/tt-revo" },
    image: "/images/produtos/tt-revo/diogo-moreira-2024-replica/1.webp",
    imageAlt: "Capacete KYT TT-Revo Diogo Moreira 2024",
    ghost: "TT-REVO",
    theme: "blue",
  },
  {
    id: "oferta",
    kicker: "Condições KYT Brasil",
    title: "PIX 10% OFF",
    subtitle: "Frete grátis para todo o Brasil e envio Full em 3 a 5 dias úteis. Compra 100% segura.",
    cta: { label: "Escolher meu capacete", href: "/produtos" },
    image: "/images/produtos/r2r/foggia-misano-2022-replica/1.webp",
    imageAlt: "Capacete KYT R2R Foggia Misano 2022",
    ghost: "FRETE GRÁTIS",
    theme: "white",
  },
  {
    id: "pilotos",
    kicker: "Racing DNA",
    title: "Usado por quem vence",
    subtitle: "Diogo Moreira, Enea Bastianini, Augusto Fernández e mais pilotos KYT nas pistas do mundo.",
    cta: { label: "Conheça os pilotos", href: "/#pilotos" },
    secondaryCta: { label: "Linha Racing", href: "/produtos" },
    image: "/images/produtos/nz-race/leopard-brazil-replica/1.webp",
    imageAlt: "Capacete KYT NZ-Race Leopard Brazil",
    ghost: "RACING",
    theme: "red",
  },
];

export function bannerPrice(banner: Banner) {
  if (!banner.priceProductId) return null;
  const product = getProduct(banner.priceProductId);
  if (!product) return null;
  return { list: product.price, pix: pixPrice(product.price) };
}
