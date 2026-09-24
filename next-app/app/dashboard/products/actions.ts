"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentCompany } from "@/lib/supabase/company";
import { revalidatePath } from "next/cache";

export async function createCategory(formData: FormData) {
  const company = await getCurrentCompany();
  if (!company) throw new Error("Empresa não encontrada.");

  const name = formData.get("name") as string;
  if (!name || name.trim().length === 0) {
    throw new Error("O nome da categoria é obrigatório.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("categories").insert({
    company_id: company.id,
    name: name.trim(),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/products");
}

export async function createProduct(formData: FormData) {
  const company = await getCurrentCompany();
  if (!company) throw new Error("Empresa não encontrada.");

  const name = formData.get("name") as string;
  const barcode = formData.get("barcode") as string;
  const categoryId = formData.get("category_id") as string;
  const priceInReais = parseFloat((formData.get("price") as string) || "0");
  const costInReais = parseFloat((formData.get("cost") as string) || "0");
  const stockQuantity = parseInt((formData.get("stock_quantity") as string) || "0", 10);

  if (!name || name.trim().length === 0) {
    throw new Error("O nome do produto é obrigatório.");
  }

  // Convertendo valores de Reais (R$) para Centavos (inteiro)
  const priceInCents = Math.round(priceInReais * 100);
  const costInCents = Math.round(costInReais * 100);

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    company_id: company.id,
    name: name.trim(),
    barcode: barcode?.trim() || null,
    category_id: categoryId || null,
    price_in_cents: priceInCents,
    cost_in_cents: costInCents,
    stock_quantity: stockQuantity,
  });

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/products");
}