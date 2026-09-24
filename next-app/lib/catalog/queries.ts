import { createClient } from "@/lib/supabase/server";
import type { CatalogData } from "./types";

export async function getCatalogData(): Promise<CatalogData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      companyId: null,
      categories: [],
      products: [],
      error: "Sua sessão expirou. Entre novamente para acessar o catálogo.",
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return {
      companyId: null,
      categories: [],
      products: [],
      error: "Não foi possível identificar a empresa ativa.",
    };
  }

  if (!membership) {
    return {
      companyId: null,
      categories: [],
      products: [],
      error: "Nenhuma empresa está vinculada ao seu usuário.",
    };
  }

  const [categoriesResult, productsResult] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("company_id", membership.company_id)
      .order("name", { ascending: true }),
    supabase
      .from("products")
      .select("*")
      .eq("company_id", membership.company_id)
      .order("name", { ascending: true }),
  ]);

  if (categoriesResult.error || productsResult.error) {
    return {
      companyId: membership.company_id,
      categories: [],
      products: [],
      error: "Não foi possível carregar o catálogo. Tente novamente.",
    };
  }

  return {
    companyId: membership.company_id,
    categories: categoriesResult.data ?? [],
    products: productsResult.data ?? [],
  };
}
