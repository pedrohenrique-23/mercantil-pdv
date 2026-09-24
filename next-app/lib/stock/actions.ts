"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { StockActionResult, StockMovement } from "./types";
import {
  parseStockQuantity,
  signedMovementQuantity,
  stockMovementInputSchema,
} from "./validation";

export async function adjustProductStock(
  formData: FormData
): Promise<StockActionResult<StockMovement>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { ok: false, error: "Sua sessão expirou. Entre novamente." };

  const parsed = stockMovementInputSchema.safeParse({
    productId: formData.get("productId"),
    movementType: formData.get("movementType"),
    quantity: parseStockQuantity(formData.get("quantity")),
    reason:
      typeof formData.get("reason") === "string"
        ? String(formData.get("reason")).trim() || null
        : null,
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Movimentação inválida.",
    };

  const { data, error } = await supabase.rpc("adjust_product_stock", {
    target_product_id: parsed.data.productId,
    movement_kind: parsed.data.movementType,
    quantity_delta: signedMovementQuantity(
      parsed.data.movementType,
      parsed.data.quantity
    ),
    movement_reason: parsed.data.reason,
  });
  if (error) {
    if (error.code === "22003")
      return {
        ok: false,
        error: "A saída não pode deixar o estoque negativo.",
      };
    if (error.code === "42501")
      return {
        ok: false,
        error: "Você não tem permissão para ajustar o estoque.",
      };
    return {
      ok: false,
      error: error.message || "Não foi possível registrar a movimentação.",
    };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    data,
    message: "Movimentação registrada e estoque atualizado.",
  };
}
