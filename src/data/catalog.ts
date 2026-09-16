import productsJson from "./products.json";
import ridersJson from "./riders.json";

export const ASSET_BASE = "https://www.capacetekyt.com.br";
export const INSTALLMENTS = 3;
export const PIX_DISCOUNT = 0.1;

export function pixPrice(price: number) {
  return Math.round(price * (1 - PIX_DISCOUNT) * 100) / 100;
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
  const idx = color.coverIndex ?? 0;
  return color.thumbnail ?? color.images[idx] ?? color.images[0] ?? "";
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

export const products: Product[] = (productsJson as Omit<Product, "price">[]).map((product) => ({
  ...product,
  price: PRODUCT_PRICES[product.id] ?? 297,
  colors: product.colors.map((color) => ({
    ...color,
    name: stripReplicaLabel(color.name),
  })),
}));

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
