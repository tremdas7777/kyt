/**
 * Ofertas do checkout (order bump) e do pós-compra (upsell).
 * Preços editáveis aqui; o servidor usa esta mesma tabela para cobrar (nunca o valor vindo do navegador).
 * As viseiras usam os preços do site oficial KYT Brasil (out/2026).
 */
export type Offer = {
  id: string;
  kind: "bump" | "upsell";
  /** Nome curto (resumo, painel). */
  name: string;
  /** Nome completo (cobrança, pedido). */
  fullName: string;
  price: number;
  compareAt?: number;
  /** Foto em public/ (opcional; sem foto o componente mostra um ícone). */
  image?: string;
  question: string;
  body: string;
  benefits: string[];
  cta: string;
};

export const SEGURO_KYT: Offer = {
  id: "seguro-kyt",
  kind: "upsell",
  name: "Seguro KYT",
  fullName: "Seguro KYT · entrega garantida + troca de tamanho",
  price: 19.9,
  compareAt: 39.9,
  question: "Quer proteger a sua compra até o capacete chegar na sua cabeça?",
  body: "Se o pedido se perder ou chegar danificado, reenviamos sem custo. E se o tamanho não ficar perfeito, você troca uma vez sem pagar o frete da troca.",
  benefits: ["Reenvio grátis em extravio ou avaria", "1 troca de tamanho sem custo de frete", "Atendimento prioritário no WhatsApp"],
  cta: "Adicionar o Seguro KYT por {preco}",
};

/** Ofertas mostradas no passo de pagamento do checkout (vazio = sem order bump). */
export const ORDER_BUMPS: Offer[] = [];

/** Viseira fumê oficial por família de capacete (foto e preço do site oficial). */
const VISOR_OFFERS: Record<string, Offer> = {
  "tt-course": visor("tt-course", "TT-Course", 159),
  "tt-revo": visor("tt-revo", "TT-Revo", 239),
  striker: visor("striker", "Striker / NZ-Race", 199),
  r2r: visor("r2r", "R2R", 199),
  "kx1-gp": visor("kx1-gp", "KX1-GP", 749),
};

function visor(family: string, model: string, price: number): Offer {
  return {
    id: `viseira-${family}`,
    kind: "upsell",
    name: `Viseira fumê ${model}`,
    fullName: `Viseira fumê escura KYT ${model} (original)`,
    price,
    image: `/images/produtos/viseiras/${family}.webp`,
    question: `Leve a viseira fumê original do ${model} junto com o capacete`,
    body: "Viseira escura original KYT, encaixe perfeito, proteção UV e troca rápida sem ferramentas. Vai na mesma caixa do seu pedido, sem frete extra.",
    benefits: ["Original KYT, mesmo encaixe da viseira cristal", "Proteção UV e anti-risco", "Sem frete adicional: vai junto com o capacete"],
    cta: "Adicionar viseira fumê por {preco}",
  };
}

const VISOR_FAMILY: Record<string, string> = {
  "tt-course": "tt-course",
  "tt-revo": "tt-revo",
  striker: "striker",
  "nz-race": "striker",
  r2r: "r2r",
  "kx1-gp": "kx1-gp",
};

/** Viseira oficial compatível com o capacete (undefined quando não há oferta para o modelo). */
export function visorOfferFor(productId: string): Offer | undefined {
  const family = VISOR_FAMILY[productId];
  return family ? VISOR_OFFERS[family] : undefined;
}

const ALL_OFFERS: Offer[] = [SEGURO_KYT, ...ORDER_BUMPS.filter((offer) => offer.id !== SEGURO_KYT.id), ...Object.values(VISOR_OFFERS)];

export function getOffer(id: string): Offer | undefined {
  return ALL_OFFERS.find((offer) => offer.id === id);
}

export function isOfferId(id: string): boolean {
  return ALL_OFFERS.some((offer) => offer.id === id);
}

/** Item de carrinho/pedido que representa uma oferta (mesma forma dos capacetes). */
export function offerCartItem(offer: Offer) {
  return {
    id: `offer::${offer.id}`,
    productId: offer.id,
    name: offer.name,
    color: offer.kind === "bump" ? "Oferta do checkout" : "Oferta pós-compra",
    size: "—",
    image: offer.image ?? "",
    price: offer.price,
    quantity: 1,
  };
}
