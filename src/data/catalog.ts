import productsJson from "./products.json";
import ridersJson from "./riders.json";

export const ASSET_BASE = "https://www.capacetekyt.com.br";
export const INSTALLMENTS = 12;
export const INSTALLMENT_FEE = 0.06;
export const PIX_DISCOUNT = 0.1;

export function pixPrice(price: number) {
  return Math.round(price * (1 - PIX_DISCOUNT) * 100) / 100;
}

export function clampInstallments(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(INSTALLMENTS, Math.max(1, n));
}

export function installmentFeeCents(amountCents: number, installments: number) {
  if (clampInstallments(installments) <= 1 || amountCents <= 0) return 0;
  return Math.round(amountCents * INSTALLMENT_FEE);
}

/** Market ranking (BR retail): city/entry touring cheapest, mid street next, composite racing highest. */
export const PRODUCT_PRICES: Record<string, number> = {
  "d-city": 297,
  "ttr-jet": 297,
  "tt-course": 297,
  "striker": 497,
  "tt-revo": 497,
  "r2r": 497,
  "nz-race": 597,
  "kx1-gp": 597,
};

export type ProductColor = {
  name: string;
  coverIndex?: number;
  images: string[];
  thumbnail?: string;
};

export type ProductSpec = { label: string; value: string };
export type ProductCallout = { label: string; description: string; side: "left" | "right" };
export type ProductVisor = { name: string; image: string };
export type ProductFeature = { title: string; description: string; image: string };

export type Product = {
  id: string;
  name: string;
  category: "Racing" | "Sport Touring" | "City";
  badge: string | null;
  description: string;
  images: string[];
  flipX?: boolean;
  defaultColorIdx?: number;
  videoUrl?: string;
  colors: ProductColor[];
  specs: ProductSpec[];
  sizes: string[];
  visors?: ProductVisor[];
  features?: ProductFeature[];
  callouts: ProductCallout[];
  price: number;
};

export type Rider = {
  id: string;
  firstName: string;
  lastName: string;
  championship: string;
  team: string;
  instagram: string;
  image: string;
};

export const categories = ["City", "Sport Touring", "Racing"] as const;

export const headSizes = [
  { id: "XS", label: "XS", cm: "53–54 cm", shell: "SM" },
  { id: "S", label: "S", cm: "55–56 cm", shell: "SM" },
  { id: "M", label: "M", cm: "57–58 cm", shell: "SM" },
  { id: "L", label: "L", cm: "59–60 cm", shell: "LXL" },
  { id: "XL", label: "XL", cm: "61–62 cm", shell: "LXL" },
  { id: "XXL", label: "XXL", cm: "63–64 cm", shell: "LXL" },
] as const;

export function assetUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${ASSET_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function colorCover(color: ProductColor) {
  return color.thumbnail ?? color.images[0] ?? "";
}

export function productCover(product: Product, colorIndex?: number) {
  const idx = colorIndex ?? product.defaultColorIdx ?? 0;
  const color = product.colors[idx] ?? product.colors[0];
  if (color) return colorCover(color);
  return product.images[0] ?? "";
}

export function stripReplicaLabel(name: string) {
  return name
    .replace(/\b(réplica|replica|rep\.)\b/gi, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function graphicSlug(name: string) {
  return stripReplicaLabel(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function findGraphicIndex(product: Product, grafia?: string) {
  if (!grafia) return product.defaultColorIdx ?? 0;
  const slug = graphicSlug(grafia);
  const bySlug = product.colors.findIndex((color) => graphicSlug(color.name) === slug);
  if (bySlug >= 0) return bySlug;
  const byName = product.colors.findIndex((color) => stripReplicaLabel(color.name).toLowerCase() === slug.replace(/-/g, " "));
  if (byName >= 0) return byName;
  const asNumber = Number(grafia);
  if (Number.isInteger(asNumber) && asNumber >= 0 && asNumber < product.colors.length) return asNumber;
  return product.defaultColorIdx ?? 0;
}

/** Sequence number encoded in the file name, e.g. "... REPLICA (3).webp" -> 3. Unnumbered files sort first. */
function imageSeqNumber(src: string) {
  const m = src.match(/\((\d+)\)/);
  return m ? Number(m[1]) : -1;
}

/** Sort gallery images by the (n) sequence in the file name; stable for unnumbered files. */
function orderedImages(images: string[]) {
  return images
    .map((src, i) => ({ src, i, n: imageSeqNumber(src) }))
    .sort((a, b) => a.n - b.n || a.i - b.i)
    .map((entry) => entry.src);
}

/** Colors hidden from the catalog: none of their photos show the helmet in side profile. */
const HIDDEN_COLORS = new Set([
  "tt-course::Tati Réplica",
  "tt-course::Fuselage Red",
  "kx1-gp::Carbon Glossy",
  "kx1-gp::Bastianini Indonésia",
  "nz-race::Black Gloss",
  "r2r::Plain Matt Black",
  "r2r::Concept Matt Blue/Yellow",
  "r2r::Straight",
  "striker::Flaming Nardo Grey Blue",
  "striker::Flaming Anth Red",
  "striker::Neutron Black/Yellow Fluo",
  "striker::Neutron Black/White",
  "striker::Brock Parkes Réplica",
  "ttr-jet::Bastianini 2022 Réplica",
  "ttr-jet::Fernandez 2022 Réplica",
  "ttr-jet::Plain Matt Black",
  "d-city::Diogo Moreira Réplica",
  "d-city::Foggia Leopard Réplica",
  "d-city::Foggia Misano 2022 Réplica",
  "d-city::98 Bomb Réplica",
  "d-city::Ratthapark Play Réplica",
  "d-city::Matt Black",
]);

export const products: Product[] = (productsJson as Omit<Product, "price">[])
  .map((product) => {
    const kept = product.colors
      .map((color, idx) => ({ color, idx }))
      .filter(({ color }) => !HIDDEN_COLORS.has(`${product.id}::${color.name}`));
    const defaultIdx = product.defaultColorIdx ?? 0;
    const newDefaultIdx = Math.max(
      0,
      kept.findIndex(({ idx }) => idx === defaultIdx),
    );
    return {
      ...product,
      price: PRODUCT_PRICES[product.id] ?? 297,
      ...(kept.length ? { defaultColorIdx: newDefaultIdx } : {}),
      colors: kept.map(({ color }) => {
        // First image (side profile) stays first; the rest follow the (n) sequence.
        const [first, ...rest] = color.images ?? [];
        const images = first ? [first, ...orderedImages(rest)] : [];
        const mapped: ProductColor = {
          ...color,
          name: stripReplicaLabel(color.name),
          images,
        };
        return mapped;
      }),
    };
  })
  // Models with no side-profile photos at all are removed from the store.
  .filter((product) => product.colors.length > 0);

export const minPrice = Math.min(...products.map((product) => product.price));
export const minPixPrice = Math.min(...products.map((product) => pixPrice(product.price)));

export const riders: Rider[] = ridersJson as Rider[];

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}

export const stats = [
  { value: "+40 anos", desc: "Fabricando capacetes de alta performance" },
  { value: "+100", desc: "Réplicas de pilotos do MotoGP, Moto2 e Moto3" },
  { value: "MotoGP™", desc: "A marca de capacetes com maior presença no campeonato mundial" },
];

export const communityPhotos = [
  "https://www.kyteurope.com/wp-content/uploads/2023/01/memories1-kyt.jpg",
  "https://www.kyteurope.com/wp-content/uploads/2023/01/memories2-kyt.jpg",
  "https://www.kyteurope.com/wp-content/uploads/2023/01/memories3-kyt.jpg",
  "https://www.kyteurope.com/wp-content/uploads/2023/01/memories4-kyt.jpg",
  "https://www.kyteurope.com/wp-content/uploads/2023/01/memories5-kyt.jpg",
  "https://www.kyteurope.com/wp-content/uploads/2023/01/memories6-kyt.jpg",
];
