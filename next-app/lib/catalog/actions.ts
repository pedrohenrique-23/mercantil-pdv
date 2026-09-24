"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  CatalogActionResult,
  Product,
  ProductUnit,
} from "./types";
import {
  categoryInputSchema,
  optionalText,
  parseMoneyToCents,
  parseQuantity,
  productInputSchema,
} from "./validation";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type CatalogActor =
  | {
      supabase: ServerSupabase;
      user: { id: string };
      membership: {
        company_id: string;
        role: "owner" | "admin" | "operator";
      };
    }
  | { supabase: ServerSupabase; error: string };

function isCatalogActorError(
  actor: CatalogActor
): actor is Extract<CatalogActor, { error: string }> {
  return "error" in actor;
}

async function getCatalogActor(): Promise<CatalogActor> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Sua sessão expirou. Entre novamente." };

  const { data: membership, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !membership) {
    return {
      supabase,
      error: "Nenhuma empresa ativa foi encontrada para o seu usuário.",
    };
  }
  if (membership.role !== "owner" && membership.role !== "admin") {
    return {
      supabase,
      error: "Você não tem permissão para alterar o catálogo.",
    };
  }
  return { supabase, user, membership };
}

function resultError(message: string): { ok: false; error: string } {
  return { ok: false, error: message };
}

export async function createCategory(
  formData: FormData
): Promise<CatalogActionResult<Category>> {
  const actor = await getCatalogActor();
  if (isCatalogActorError(actor)) return resultError(actor.error);
  const parsed = categoryInputSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success)
    return resultError(
      parsed.error.issues[0]?.message ?? "Categoria inválida."
    );

  const { data, error } = await actor.supabase
    .from("categories")
    .insert({
      company_id: actor.membership.company_id,
      name: parsed.data.name,
      created_by: actor.user.id,
    })
    .select("*")
    .single();
  if (error)
    return resultError(
      error.code === "23505"
        ? "Já existe uma categoria com esse nome."
        : "Não foi possível criar a categoria."
    );
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Categoria criada com sucesso." };
}

export async function updateCategory(
  formData: FormData
): Promise<CatalogActionResult<Category>> {
  const actor = await getCatalogActor();
  if (isCatalogActorError(actor)) return resultError(actor.error);
  const id = String(formData.get("id") ?? "");
  const parsed = categoryInputSchema.safeParse({ name: formData.get("name") });
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return resultError("Informe uma categoria válida.");

  const { data, error } = await actor.supabase
    .from("categories")
    .update({ name: parsed.data.name })
    .eq("id", id)
    .eq("company_id", actor.membership.company_id)
    .select("*")
    .single();
  if (error)
    return resultError(
      error.code === "23505"
        ? "Já existe uma categoria com esse nome."
        : "Não foi possível atualizar a categoria."
    );
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Categoria atualizada com sucesso." };
}

export async function archiveCategory(
  formData: FormData
): Promise<CatalogActionResult<{ id: string }>> {
  const actor = await getCatalogActor();
  if (isCatalogActorError(actor)) return resultError(actor.error);
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success)
    return resultError("Categoria inválida.");
  const { error } = await actor.supabase
    .from("categories")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", actor.membership.company_id);
  if (error) return resultError("Não foi possível arquivar a categoria.");
  revalidatePath("/dashboard");
  return { ok: true, data: { id }, message: "Categoria arquivada." };
}

function parseProduct(formData: FormData) {
  return productInputSchema.safeParse({
    name: formData.get("name"),
    categoryId: optionalText(formData.get("categoryId")),
    barcode: optionalText(formData.get("barcode")),
    sku: optionalText(formData.get("sku")),
    unit: formData.get("unit"),
    costCents: parseMoneyToCents(formData.get("cost")),
    saleCents: parseMoneyToCents(formData.get("sale")),
    stockQuantity: parseQuantity(formData.get("stock")),
    minStockQuantity: parseQuantity(formData.get("minStock")),
  });
}

function productPayload(
  data: z.infer<typeof productInputSchema>,
  companyId: string,
  userId: string
) {
  return {
    company_id: companyId,
    category_id: data.categoryId,
    name: data.name,
    barcode: data.barcode,
    sku: data.sku,
    unit: data.unit as ProductUnit,
    cost_cents: data.costCents,
    sale_cents: data.saleCents,
    stock_quantity: data.stockQuantity,
    min_stock_quantity: data.minStockQuantity,
    created_by: userId,
  };
}

export async function createProduct(
  formData: FormData
): Promise<CatalogActionResult<Product>> {
  const actor = await getCatalogActor();
  if (isCatalogActorError(actor)) return resultError(actor.error);
  const parsed = parseProduct(formData);
  if (!parsed.success)
    return resultError(parsed.error.issues[0]?.message ?? "Produto inválido.");
  const { data, error } = await actor.supabase
    .from("products")
    .insert(
      productPayload(parsed.data, actor.membership.company_id, actor.user.id)
    )
    .select("*")
    .single();
  if (error)
    return resultError(
      error.code === "23505"
        ? "Código de barras ou SKU já cadastrado."
        : "Não foi possível criar o produto."
    );
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Produto criado com sucesso." };
}

export async function updateProduct(
  formData: FormData
): Promise<CatalogActionResult<Product>> {
  const actor = await getCatalogActor();
  if (isCatalogActorError(actor)) return resultError(actor.error);
  const id = String(formData.get("id") ?? "");
  const parsed = parseProduct(formData);
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return resultError("Informe dados válidos para o produto.");
  const payload = productPayload(
    parsed.data,
    actor.membership.company_id,
    actor.user.id
  );
  const { data, error } = await actor.supabase
    .from("products")
    .update({
      category_id: payload.category_id,
      name: payload.name,
      barcode: payload.barcode,
      sku: payload.sku,
      unit: payload.unit,
      cost_cents: payload.cost_cents,
      sale_cents: payload.sale_cents,
      stock_quantity: payload.stock_quantity,
      min_stock_quantity: payload.min_stock_quantity,
    })
    .eq("id", id)
    .eq("company_id", actor.membership.company_id)
    .select("*")
    .single();
  if (error)
    return resultError(
      error.code === "23505"
        ? "Código de barras ou SKU já cadastrado."
        : "Não foi possível atualizar o produto."
    );
  revalidatePath("/dashboard");
  return { ok: true, data, message: "Produto atualizado com sucesso." };
}

export async function archiveProduct(
  formData: FormData
): Promise<CatalogActionResult<{ id: string }>> {
  const actor = await getCatalogActor();
  if (isCatalogActorError(actor)) return resultError(actor.error);
  const id = String(formData.get("id") ?? "");
  if (!z.string().uuid().safeParse(id).success)
    return resultError("Produto inválido.");
  const { error } = await actor.supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", actor.membership.company_id);
  if (error) return resultError("Não foi possível arquivar o produto.");
  revalidatePath("/dashboard");
  return { ok: true, data: { id }, message: "Produto arquivado." };
}
