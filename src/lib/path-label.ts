export function pathLabel(path: string): string {
  if (path === "/" || path === "") return "Início";
  if (path === "/produtos") return "Catálogo";
  if (path.startsWith("/produtos/")) {
    const slug = path.slice("/produtos/".length).split("/")[0] ?? "";
    return slug.replace(/-/g, " ").toUpperCase() || "Produto";
  }
  if (path.startsWith("/carrinho")) return "Carrinho";
  if (path.startsWith("/checkout")) return "Checkout";
  if (path.startsWith("/pedido")) return "PIX gerado";
  if (path.startsWith("/obrigado")) return "Obrigado";
  if (path.startsWith("/contato")) return "Contato";
  return path;
}
