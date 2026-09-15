import { stats } from "@/data/catalog";

export function DnaSection() {
  return (
    <section
      id="sobre"
      className="relative w-full py-24 lg:py-32"
      style={{
        backgroundImage:
          "linear-gradient(rgba(8, 8, 8, 0.82), rgba(8, 8, 8, 0.82)), url('https://www.capacetekyt.com.br/images/carbonfiber.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-3 font-display text-xs font-bold tracking-[0.16em] text-[#CC2222] uppercase">
              100% DNA italiano.
            </p>
            <h2
              className="font-display font-black uppercase leading-tight text-[#F0F0F0]"
              style={{ fontSize: "clamp(2rem, 3.5vw, 3.5rem)" }}
            >
              Tecnologia das pistas
              <br />
              ao seu alcance.
            </h2>
            <p className="mt-6 max-w-xl font-sans text-base leading-[1.8] text-[#6A6A6A]">
              A KYT tem em seu DNA o espírito esportivo Racing, explorando ao máximo seus produtos nas mais
              importantes competições do mundo. É a marca de capacetes com maior presença no MotoGP — sempre
              apoiando pilotos de ponta que nos ajudam no desenvolvimento de produtos cada vez mais modernos
              e tecnológicos. Com gráficos originais, design arrojado e certificação FIM, a KYT é a marca dos
              campeões.
            </p>
            <a
              href="/contato"
              className="mt-8 inline-flex items-center gap-3 border border-white/15 px-7 py-3 font-display text-sm font-bold tracking-[0.12em] text-[#F0F0F0] uppercase transition-colors hover:border-[#CC2222] hover:text-[#CC2222]"
            >
              Conheça nossa história
            </a>
          </div>
          <div className="grid gap-8">
            {stats.map((stat) => (
              <div key={stat.value} className="border-l-2 border-[#CC2222] pl-6">
                <p className="font-display text-4xl font-black text-white md:text-5xl">{stat.value}</p>
                <p
                  className={`mt-2 font-sans text-[13px] leading-snug ${
                    stat.value === "MotoGP™" ? "text-[rgba(255,255,255,0.7)]" : "text-[#6A6A6A]"
                  }`}
                >
                  {stat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
