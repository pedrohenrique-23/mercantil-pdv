import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import { redirect } from "next/navigation";
import { createCategory, createProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const company = await getCurrentCompany();
  if (!company) redirect("/login");

  const supabase = await createClient();

  // Buscar categorias e produtos em paralelo
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("company_id", company.id)
      .order("name"),
    supabase
      .from("products")
      .select("*, categories(name)")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1>Produtos e Estoque</h1>
          <p style={{ color: "#666" }}>Empresa: <strong>{company.name}</strong></p>
        </div>
        <a href="/dashboard" style={{ color: "#0070f3" }}>← Voltar ao Dashboard</a>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
        {/* Formulários na Coluna Esquerda */}
        <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Criar Categoria */}
          <div style={{ padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
            <h3>Nova Categoria</h3>
            <form action={createCategory} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <input type="text" name="name" placeholder="Ex: Bebidas" required style={{ padding: 8 }} />
              <button type="submit" style={{ padding: 8, cursor: "pointer" }}>Salvar Categoria</button>
            </form>
          </div>

          {/* Criar Produto */}
          <div style={{ padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
            <h3>Novo Produto</h3>
            <form action={createProduct} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <input type="text" name="name" placeholder="Nome do Produto" required style={{ padding: 8 }} />
              <input type="text" name="barcode" placeholder="Código de Barras (opcional)" style={{ padding: 8 }} />
              
              <select name="category_id" style={{ padding: 8 }}>
                <option value="">Sem Categoria</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input type="number" step="0.01" name="price" placeholder="Preço (R$)" required style={{ padding: 8 }} />
                <input type="number" step="0.01" name="cost" placeholder="Custo (R$)" style={{ padding: 8 }} />
              </div>

              <input type="number" name="stock_quantity" placeholder="Estoque Inicial" defaultValue={0} style={{ padding: 8 }} />

              <button type="submit" style={{ padding: 10, cursor: "pointer", background: "#17352a", color: "#fff", border: 0, borderRadius: 4 }}>
                Cadastrar Produto
              </button>
            </form>
          </div>
        </section>

        {/* Tabela de Produtos na Coluna Direita */}
        <section style={{ padding: 16, border: "1px solid #ccc", borderRadius: 8 }}>
          <h3>Produtos Cadastrados ({products?.length ?? 0})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #ddd", textAlign: "left" }}>
                <th style={{ padding: 8 }}>Nome</th>
                <th style={{ padding: 8 }}>Categoria</th>
                <th style={{ padding: 8 }}>Preço</th>
                <th style={{ padding: 8 }}>Estoque</th>
              </tr>
            </thead>
            <tbody>
              {products && products.length > 0 ? (
                products.map((prod) => (
                  <tr key={prod.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>
                      <strong>{prod.name}</strong>
                      {prod.barcode && <div style={{ fontSize: 11, color: "#888" }}>{prod.barcode}</div>}
                    </td>
                    <td style={{ padding: 8 }}>
                      {(prod.categories as unknown as { name: string })?.name ?? "-"}
                    </td>
                    <td style={{ padding: 8 }}>
                      R$ {(prod.price_in_cents / 100).toFixed(2)}
                    </td>
                    <td style={{ padding: 8 }}>{prod.stock_quantity} un</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#888" }}>
                    Nenhum produto cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}