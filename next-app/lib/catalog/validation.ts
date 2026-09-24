import { z } from "zod";

export const categoryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "A categoria precisa ter pelo menos 2 caracteres.")
    .max(80),
});

export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "O produto precisa ter pelo menos 2 caracteres.")
    .max(160),
  categoryId: z.string().uuid().nullable(),
  barcode: z.string().trim().max(80).nullable(),
  sku: z.string().trim().max(80).nullable(),
  unit: z.enum(["unit", "kg", "g", "l", "ml", "box", "pack"]),
  costCents: z.number().int().min(0),
  saleCents: z.number().int().min(0),
  stockQuantity: z.number().min(0),
  minStockQuantity: z.number().min(0),
});

export function optionalText(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

export function parseMoneyToCents(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}

export function parseQuantity(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}
