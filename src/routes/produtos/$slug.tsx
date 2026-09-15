import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";

import { PriceLines } from "@/components/product/PriceLines";
import { ProductBuyBox } from "@/components/product/ProductBuyBox";
import { assetUrl, getProduct, pixPrice, productCover, products } from "@/data/catalog";
import { formatBRL } from "@/lib/format";

type ProductSearch = {
  grafia?: string;
};

export const Route = createFileRoute("/produtos/$slug")({
  validateSearch: (search: Record<string, unknown>): ProductSearch => {
    const grafia = typeof search["grafia"] === "string" ? search["grafia"].trim() : "";
    return grafia ? { grafia } : {};
  },
  loader: ({ params }) => {
    const product = getProduct(params.slug);
    if (!product) throw notFound();
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.product.name ?? "Produto"} | KYT Capacetes Brasil` },
      { name: "description", content: loaderData?.product.description ?? "" },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { grafia } = Route.useSearch();
  const related = useMemo(
    () => products.filter((item) => item.id !== product.id).slice(0, 3),
    [product.id],
  );

  return (
    <article className="pt-24 pb-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <p className="mb-10 font-display text-xs font-bold tracking-[0.16em] text-[#6A6A6A] uppercase">
          <Link to="/" className="hover:text-white">
            Início
          </Link>
          {" / "}
          <Link to="/produtos" className="hover:text-white">
            Produtos
          </Link>
          {" / "}
          <span className="text-[#CC2222]">{product.name}</span>
        </p>

        <ProductBuyBox product={product} {...(grafia ? { grafia } : {})} />

        <section className="mt-24 grid gap-12 lg:grid-cols-2">
          <div>
            <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
              Especificações
            </p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase">Ficha Técnica</h2>
            <p className="mt-2 text-sm text-[#6A6A6A]">{product.specs.length} especificações</p>
          </div>
          <dl className="divide-y divide-white/10 border-t border-white/10">
            {product.specs.map((spec) => (
              <div key={spec.label} className="grid grid-cols-1 gap-1 py-4 sm:grid-cols-[180px_1fr]">
                <dt className="font-display text-sm font-bold tracking-wide uppercase">{spec.label}</dt>
                <dd className="text-sm text-[#6A6A6A]">{spec.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        {product.callouts.length > 0 ? (
          <section className="mt-24">
            <p className="font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
              Tecnologia
            </p>
            <h2 className="mt-2 font-display text-4xl font-black uppercase">Engenharia de Corrida</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {product.callouts.map((item) => (
                <div key={item.label} className="border border-white/10 bg-[#0e0e0e] p-6">
                  <h3 className="font-display text-xl font-bold uppercase">{item.label}</h3>
                  <p className="mt-2 text-sm text-[#6A6A6A]">{item.description}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {product.features && product.features.length > 0 ? (
          <section className="mt-24 grid gap-8 md:grid-cols-2">
            {product.features.map((feature) => (
              <div key={feature.title} className="overflow-hidden bg-[#111]">
                <img src={feature.image} alt={feature.title} className="aspect-video w-full object-cover" />
                <div className="p-6">
                  <h3 className="font-display text-2xl font-bold uppercase">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6A6A6A]">{feature.description}</p>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <section className="mt-24 border border-white/10 bg-[#0e0e0e] px-6 py-12 text-center">
          <h2 className="font-display text-4xl font-black uppercase">Leve o {product.name}</h2>
          <div className="mx-auto mt-4 max-w-sm">
            <PriceLines price={product.price} />
          </div>
          <p className="mt-3 text-sm text-[#6A6A6A]">Frete grátis · escolha cor e tamanho acima</p>
        </section>

        <section className="mt-24">
          <h2 className="font-display text-3xl font-black uppercase">Outros modelos</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {related.map((item) => (
              <Link key={item.id} to="/produtos/$slug" params={{ slug: item.id }} className="group">
                <div className="overflow-hidden bg-[#111]">
                  <img
                    src={assetUrl(productCover(item))}
                    alt={item.name}
                    className="aspect-square w-full object-contain"
                  />
                </div>
                <h3 className="mt-3 font-display text-xl font-black uppercase">{item.name}</h3>
                <p className="text-sm text-[#CC2222]">{formatBRL(pixPrice(item.price))} no PIX</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
