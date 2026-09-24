import { createClient } from "@/lib/supabase/server";
import type { CashData } from "./types";

export async function getCashData(): Promise<CashData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      register: null,
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
      register: null,
      movements: [],
      error: "Nenhuma empresa ativa foi encontrada.",
    };
  const { data: register, error } = await supabase
    .from("cash_registers")
    .select("*")
    .eq("company_id", membership.company_id)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    return {
      register: null,
      movements: [],
      error: "Não foi possível carregar o caixa.",
    };
  if (!register) return { register: null, movements: [] };
  const { data: movements, error: movementError } = await supabase
    .from("cash_movements")
    .select("*")
    .eq("cash_register_id", register.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (movementError)
    return {
      register,
      movements: [],
      error: "Não foi possível carregar os movimentos do caixa.",
    };
  return { register, movements: movements ?? [] };
}
