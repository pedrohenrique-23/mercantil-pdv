import { z } from "zod";

export const stockMovementInputSchema = z.object({
  productId: z.string().uuid("Produto inválido."),
  movementType: z.enum([
    "purchase",
    "adjustment_in",
    "adjustment_out",
    "return",
    "loss",
  ]),
  quantity: z.number().positive("A quantidade deve ser maior que zero."),
  reason: z.string().trim().max(160).nullable(),
});

export function signedMovementQuantity(
  type: z.infer<typeof stockMovementInputSchema>["movementType"],
  quantity: number
) {
  return ["adjustment_out", "loss"].includes(type) ? -quantity : quantity;
}

export function parseStockQuantity(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : NaN;
}
