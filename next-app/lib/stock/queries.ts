import { createClient } from "@/lib/supabase/server";
import type { StockData } from "./types";

export async function getStockData(): Promise<StockData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      products: [],
      movements: [],
      error: "Sua sessão expirou. Entre novamente.",
    };

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership)
    return {
      products: [],
      movements: [],
      error: "Nenhuma empresa ativa foi encontrada.",
    };

  const [productsResult, movementsResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,name,barcode,sku,unit,stock_quantity,min_stock_quantity,is_active"
      )
      .eq("company_id", membership.company_id)
      .order("name"),
    supabase
      .from("stock_movements")
      .select("*")
      .eq("company_id", membership.company_id)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  if (productsResult.error || movementsResult.error)
    return {
      products: [],
      movements: [],
      error: "Não foi possível carregar o estoque.",
    };
  return {
    products: productsResult.data ?? [],
    movements: movementsResult.data ?? [],
  };
}
